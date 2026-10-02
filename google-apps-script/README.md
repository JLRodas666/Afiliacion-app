# Integración pendiente para PDF de afiliación

Estado: código preparado; no desplegado ni conectado al formulario.

El conector de Google Drive de Sites recibe referencias de archivo del entorno, no los bytes de un adjunto seleccionado en el navegador. No se debe inventar una referencia ni enviar un archivo en base64 al conector. Esta integración recibe el archivo desde el servidor de la aplicación mediante Google Apps Script y lo guarda en la subcarpeta privada ya creada.

## Activación

1. Crear un proyecto de Google Apps Script con `PdfUpload.gs` usando una cuenta autorizada del sindicato que pueda escribir en la carpeta.
2. Configurar una clave aleatoria fuerte en la propiedad `STUNI_UPLOAD_SECRET`.
3. Autorizar el acceso a Google Drive y desplegar el script como aplicación web ejecutada por el propietario. El endpoint debe poder recibir solicitudes del servidor de la aplicación; todas se autentican con la clave.
4. Guardar la URL y la clave en los secretos del servidor de Sites. No incluir la clave en código público ni en el navegador.
5. Añadir una ruta de adjuntos que compruebe la identidad de lozano@stuni.es o admin@stuni.es, el origen, el formato PDF y el tamaño antes de invocar el script.
6. Integrar el envío en el formulario y distinguir los resultados de la subida del PDF y del guardado de la afiliación. En un fallo parcial, conservar la referencia del PDF y evitar repetir un alta sin comprobar la hoja.
7. Verificar con un PDF de prueba sin datos personales, comprobar el archivo en Drive y eliminar solo ese archivo de prueba mediante una operación recuperable.

La carpeta de destino es `01_PDF_AFILIACIONES_STUNI`, dentro de `16_AFILIACIONES_STUNI`. El script no concede permisos a los documentos ni permite elegir una carpeta de destino desde la solicitud.
