"""
Router REST API & WebSocket cho Backend VPS chạy song song MQTT.
Tương thích chuẩn REST + WS của tue-minh/IoT_Backend và hệ thống tưới cà chua 3 hàng.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    Token,
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_password_hash,
)
from db import (
    Alert,
    Command,
    Device,
    EventLog,
    History,
    Schedule,
    SensorData,
    TelemetryLog,
    User,
    get_db,
)
from mqtt import mqtt_handler
from websocket_manager import manager

router = APIRouter()


@router.websocket("/ws/sensor_data")
async def websocket_endpoint(websocket: WebSocket):
    """Kênh WebSocket đẩy dữ liệu telemetry, event và trạng thái online/offline realtime."""
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)


# =================== SCHEMAS ===================


class UserCreate(BaseModel):
    email: str
    name: str
    password: str


class UserSchema(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DeviceCreate(BaseModel):
    id: Optional[str] = None
    name: str
    type: Optional[str] = "tomato_irrigation_3row"
    status: Optional[str] = "offline"


class DeviceSchema(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: str
    type: Optional[str] = None
    status: Optional[str] = None
    last_seq: Optional[int] = 0
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CommandRequest(BaseModel):
    device_id: str
    action: str
    row: Optional[int] = None
    params: Optional[Dict[str, Any]] = None


class ConfigPublishRequest(BaseModel):
    device_id: str
    config: Dict[str, Any]


# =================== AUTH & USERS ===================


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if len(user.password) < 8:
        raise HTTPException(status_code=400, detail="Mật khẩu phải tối thiểu 8 ký tự")
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email này đã được sử dụng")

    db_user = User(
        email=user.email,
        name=user.name,
        role="operator",
        password_hash=get_password_hash(user.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    db.add(
        History(
            performer_id=db_user.id,
            event_type="USER_REGISTER",
            description=f"Đăng ký người dùng {db_user.name} ({db_user.email})",
            related_id=db_user.id,
        )
    )
    db.commit()
    return db_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer", "username": user.name, "role": user.role}


@router.get("/users/me", response_model=UserSchema)
def read_users_me(current_user: Annotated[User, Depends(get_current_active_user)]):
    return current_user


# =================== DEVICES & TELEMETRY ===================


@router.get("/devices", response_model=List[DeviceSchema])
def get_devices(db: Session = Depends(get_db)):
    return db.scalars(select(Device)).all()


@router.post("/devices", response_model=DeviceSchema, status_code=status.HTTP_201_CREATED)
def create_device(device: DeviceCreate, db: Session = Depends(get_db)):
    dev = Device(
        id=device.id or device.name.lower().replace(" ", "_"),
        name=device.name,
        type=device.type,
        status=device.status,
    )
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return dev


@router.get("/devices/{device_id}/latest")
def get_device_latest(device_id: str, db: Session = Depends(get_db)):
    dev = db.get(Device, device_id)
    row = (
        db.query(TelemetryLog)
        .filter(TelemetryLog.device_id == device_id)
        .order_by(desc(TelemetryLog.id))
        .first()
    )
    return {
        "device_id": device_id,
        "device_status": dev.status if dev else "unknown",
        "mqtt_connected": mqtt_handler.connected,
        "telemetry": {
            "id": row.id,
            "device_id": row.device_id,
            "seq": row.seq,
            "recorded_at": row.recorded_at,
            "received_at": row.received_at.isoformat() if row.received_at else None,
            "soil_json": row.soil_json,
            "temperature_c": row.temperature_c,
            "rh_pct": row.rh_pct,
            "vpd_kpa": row.vpd_kpa,
            "rows_json": row.rows_json,
            "tank_ok": row.tank_ok,
            "pump_on": row.pump_on,
            "cf_synced": row.cf_synced,
        }
        if row
        else None,
    }


@router.get("/devices/{device_id}/history")
def get_device_history(device_id: str, limit: int = 120, db: Session = Depends(get_db)):
    rows = (
        db.query(TelemetryLog)
        .filter(TelemetryLog.device_id == device_id)
        .order_by(desc(TelemetryLog.id))
        .limit(min(limit, 500))
        .all()
    )
    samples = [
        {
            "id": r.id,
            "device_id": r.device_id,
            "seq": r.seq,
            "recorded_at": r.recorded_at,
            "received_at": r.received_at.isoformat() if r.received_at else None,
            "soil_json": r.soil_json,
            "temperature_c": r.temperature_c,
            "rh_pct": r.rh_pct,
            "vpd_kpa": r.vpd_kpa,
            "rows_json": r.rows_json,
            "tank_ok": r.tank_ok,
            "pump_on": r.pump_on,
        }
        for r in reversed(rows)
    ]
    return {"device_id": device_id, "samples": samples}


@router.get("/devices/{device_id}/events")
def get_device_events(device_id: str, limit: int = 50, db: Session = Depends(get_db)):
    evs = (
        db.query(EventLog)
        .filter(EventLog.device_id == device_id)
        .order_by(desc(EventLog.id))
        .limit(min(limit, 200))
        .all()
    )
    return {
        "device_id": device_id,
        "events": [
            {
                "id": e.id,
                "recorded_at": e.recorded_at,
                "row": e.row,
                "type": e.type,
                "liters": e.liters,
            }
            for e in evs
        ],
    }


@router.get("/sensor_data")
def get_sensor_data(device_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(SensorData)
    if device_id:
        q = q.filter(SensorData.device_id == device_id)
    return q.all()


# =================== MQTT COMMANDS & CONFIG ===================


@router.get("/commands")
def get_commands(device_id: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(Command)
    if device_id:
        q = q.filter(Command.device_id == device_id)
    return q.order_by(desc(Command.created_at)).limit(min(limit, 200)).all()


@router.post("/commands", status_code=status.HTTP_201_CREATED)
def create_command(
    req: CommandRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    payload: Dict[str, Any] = {"action": req.action}
    if req.row is not None:
        payload["row"] = req.row
    if req.params:
        payload.update(req.params)

    sent_mqtt = mqtt_handler.publish_command(req.device_id, payload)
    db_cmd = Command(
        device_id=req.device_id,
        performer_id=current_user.id,
        action=req.action,
        params_json=json.dumps(payload),
        status="published_mqtt" if sent_mqtt else "queued_offline",
        executed_at=datetime.now(timezone.utc) if sent_mqtt else None,
    )
    db.add(db_cmd)
    db.add(
        History(
            device_id=req.device_id,
            performer_id=current_user.id,
            event_type="MQTT_COMMAND",
            description=f"{current_user.name} gửi lệnh MQTT '{req.action}' (row={req.row}) -> mqtt={sent_mqtt}",
            related_id=db_cmd.id,
        )
    )
    db.commit()
    db.refresh(db_cmd)
    return {
        "id": db_cmd.id,
        "device_id": db_cmd.device_id,
        "action": db_cmd.action,
        "mqtt_published": sent_mqtt,
        "status": db_cmd.status,
    }


@router.post("/config")
def push_config(
    req: ConfigPublishRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    sent = mqtt_handler.publish_config(req.device_id, req.config)
    db.add(
        History(
            device_id=req.device_id,
            performer_id=current_user.id,
            event_type="MQTT_CONFIG",
            description=f"{current_user.name} đẩy cấu hình mới qua MQTT (sent={sent})",
        )
    )
    db.commit()
    return {"device_id": req.device_id, "mqtt_published": sent}


# =================== ALERTS, HISTORY, SCHEDULES ===================


@router.get("/alerts")
def get_alerts(device_id: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(Alert)
    if device_id:
        q = q.filter(Alert.device_id == device_id)
    return q.order_by(desc(Alert.timestamp)).limit(min(limit, 200)).all()


@router.get("/history")
def get_history(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(History).order_by(desc(History.timestamp)).limit(min(limit, 200)).all()


@router.get("/schedules")
def get_schedules(db: Session = Depends(get_db)):
    return db.scalars(select(Schedule)).all()
