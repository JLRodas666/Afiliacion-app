// Google Apps Script bridge for the private STUNI app.
// Set STUNI_UPLOAD_SECRET in Script Properties before deploying.
// The secret belongs only in the private Site's server-side settings.
const PDF_FOLDER_ID = '1v7_V2VPmcTJQvwzZOigM3le6feDXuCzs';
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function doPost(event) {
  const reply = (value) => ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
  let request;
  try { request = JSON.parse(event.postData.contents); }
  catch (_) { return reply({ ok: false, message: 'Solicitud no válida.' }); }
  const properties = PropertiesService.getScriptProperties();
  const secret = properties.getProperty('STUNI_UPLOAD_SECRET');
  if (!secret || typeof request.token !== 'string' || request.token !== secret) {
    return reply({ ok: false, message: 'Acceso no autorizado.' });
  }
  if (!/^[a-f0-9-]{36}$/i.test(String(request.operationId || '')) ||
      typeof request.fileName !== 'string' || !/\.pdf$/i.test(request.fileName) ||
      typeof request.base64 !== 'string' || request.base64.length > Math.ceil(MAX_PDF_BYTES * 4 / 3) + 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(request.base64)) {
    return reply({ ok: false, message: 'Selecciona un PDF válido de hasta 5 MB.' });
  }
  let bytes;
  try { bytes = Utilities.base64Decode(request.base64); }
  catch (_) { return reply({ ok: false, message: 'No se pudo leer el PDF.' }); }
  if (bytes.length > MAX_PDF_BYTES || bytes.length < 5 ||
      bytes.slice(0, 5).map((value) => String.fromCharCode(value & 255)).join('') !== '%PDF-') {
    return reply({ ok: false, message: 'El archivo no es un PDF válido.' });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return reply({ ok: false, message: 'Hay otro envío en curso. Comprueba el resultado antes de repetirlo.' });
  try {
    const folder = DriveApp.getFolderById(PDF_FOLDER_ID);
    // A stable operation filename makes an interrupted upload safe to inspect.
    const safeName = request.fileName.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 140);
    const name = request.operationId + '_' + safeName;
    const existing = folder.getFilesByName(name);
    const file = existing.hasNext() ? existing.next() : folder.createFile(Utilities.newBlob(bytes, 'application/pdf', name));
    return reply({ ok: true, fileId: file.getId(), url: file.getUrl(), name: file.getName() });
  } catch (_) {
    return reply({ ok: false, message: 'No se pudo confirmar el archivo. Comprueba la carpeta antes de repetir el envío.' });
  } finally { lock.releaseLock(); }
}
