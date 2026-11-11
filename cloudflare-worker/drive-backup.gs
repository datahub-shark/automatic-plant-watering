// Chạy trong Google Apps Script thuộc tài khoản Google của chủ dữ liệu.
// Script Properties cần có: API_BASE, BACKUP_TOKEN, FOLDER_ID.
// Đặt múi giờ project là Asia/Ho_Chi_Minh và trigger backupYesterday mỗi ngày sau 07:00.
function backupYesterday() {
  const yesterday = new Date(Date.now() - 86400000);
  const day = Utilities.formatDate(yesterday, 'UTC', 'yyyy-MM-dd');
  backupDay(day);
}

function backupDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Ngày không hợp lệ');
  const props = PropertiesService.getScriptProperties();
  const base = props.getProperty('API_BASE');
  const token = props.getProperty('BACKUP_TOKEN');
  const folderId = props.getProperty('FOLDER_ID');
  if (!base || !token || !folderId) throw new Error('Thiếu Script Properties');
  const folder = DriveApp.getFolderById(folderId);
  ['telemetry', 'events'].forEach(kind => {
    const lines = [];
    let after = 0;
    for (let page = 0; page < 100; page++) {
      const url = base.replace(/\/$/, '') + '/api/v1/backup/' + kind +
        '?day=' + encodeURIComponent(day) + '&after=' + after;
      const response = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
      });
      if (response.getResponseCode() !== 200) {
        throw new Error(kind + ' HTTP ' + response.getResponseCode());
      }
      const body = JSON.parse(response.getContentText());
      if (!Array.isArray(body.items) || typeof body.next_after !== 'number') {
        throw new Error('Phản hồi sao lưu không hợp lệ');
      }
      body.items.forEach(item => lines.push(JSON.stringify(item)));
      if (!body.has_more) break;
      if (body.next_after <= after || page === 99) throw new Error('Phân trang thất bại');
      after = body.next_after;
    }
    const name = 'tomato-' + kind + '-' + day + '.jsonl.gz';
    const raw = Utilities.newBlob(lines.join('\n') + (lines.length ? '\n' : ''), 'application/x-ndjson');
    const compressed = Utilities.gzip(raw, name);
    const created = folder.createFile(compressed);
    if (created.getSize() !== compressed.getBytes().length) {
      created.setTrashed(true);
      throw new Error('Kích thước file lưu không khớp: ' + name);
    }
    // Chỉ thay bản cũ sau khi đã tạo và kiểm tra bản mới.
    const oldFiles = folder.getFilesByName(name);
    while (oldFiles.hasNext()) {
      const old = oldFiles.next();
      if (old.getId() !== created.getId()) old.setTrashed(true);
    }
    console.log(name + ': ' + lines.length + ' bản ghi');
  });
}
