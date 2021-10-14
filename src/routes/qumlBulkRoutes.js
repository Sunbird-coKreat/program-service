const qumlBulkUpload = require("../service/qumlBulkService-latest");
const requestMiddleware = require('../middlewares/request.middleware')
const qumlRequestMiddleware = require('../middlewares/quml.middleware');
const BASE_URL = '/question/v1';

module.exports = function (app) {
    app.route(BASE_URL + '/bulkUpload/:questionset_id')
      .post(requestMiddleware.gzipCompression(), requestMiddleware.createAndValidateRequestBody,
       qumlRequestMiddleware.validateRequestBody, qumlBulkUpload.bulkUpload);

  
    app.route(BASE_URL + '/bulkUploadStatus')
      .post(requestMiddleware.gzipCompression(), requestMiddleware.createAndValidateRequestBody,
      qumlBulkUpload.qumlSearch);
  }
  