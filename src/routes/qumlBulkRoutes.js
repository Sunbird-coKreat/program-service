const qumlBulkUpload = require("../service/qumlBulkService-latest");
const requestMiddleware = require('../middlewares/request.middleware')
const qumlRequestMiddleware = require('../validators/qumlBulkUploadValidators');
const BASE_URL = '/question/v1';

module.exports = function (app) {
    app.route(BASE_URL + '/bulkupload/')
      .post(requestMiddleware.gzipCompression(), requestMiddleware.createAndValidateRequestBody,
      requestMiddleware.checkChannelID,
      qumlRequestMiddleware.qumlBulkUploadValidator(),qumlRequestMiddleware.validate, qumlBulkUpload.bulkUpload);

    app.route(BASE_URL + '/bulkUploadStatus')
      .post(requestMiddleware.gzipCompression(), requestMiddleware.createAndValidateRequestBody,
      qumlBulkUpload.qumlSearch);
  }
  