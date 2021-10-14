'use strict';
const { google } = require('googleapis');
const fs = require('fs');
const os = require('os');
const path = require('path');

class GoogleOauth {
  auth = null;
  constructor() {
    this.auth = new google.auth.GoogleAuth({
      keyFile: path.join(
        __dirname,
        '../../question-bulk-upload-328207-6ba6526a9398.json'
      ),
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/drive.photos.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    });
  }
  async downloadFile(fileId, filepath = '') {
    const drive = google.drive({ version: 'v3', auth: this.auth});
    const readFileRes = await drive.files.get({ fileId: fileId });
    return drive.files
      .get({ fileId, alt: 'media' }, { responseType: 'stream' })
      .then((res) => {
        return new Promise((resolve, reject) => {
          const filePath = filepath ? filepath : path.join(os.tmpdir(), readFileRes.data.name);
          console.log(`writing to ${filePath}`);
          const dest = fs.createWriteStream(filePath);
          let progress = 0;
          res.data
            .on('end', () => {
              console.log(`Done downloading file ==> ${fileId}`);
              resolve({filePath, ...readFileRes.data});
            })
            .on('error', (err) => {
              console.error('Error downloading file.');
              reject(err);
            })
            .on('data', (d) => {
              progress += d.length;
              if (process.stdout.isTTY) {
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                process.stdout.write(
                  `Downloaded ${progress} bytes for ==> ${fileId}`
                );
              }
            })
            .pipe(dest);
        });
      });
  }
}

module.exports = GoogleOauth;
