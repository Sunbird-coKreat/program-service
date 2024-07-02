const { buildDOCXWithCallback } = require("../service/print/docx");

const {
  buildDOCX_1_WithCallback,
} = require("../service/print/printDocxV1.0/docx");
const { buildCSVWithCallback } = require("../service/print/csv");

const requestMiddleware = require("../middlewares/request.middleware");
const BASE_URL = "/program/v1";
// Refactor this to move to service
async function printDocx(req, res) {
  const id = req.query.id;
  const format = req.query.format;
  const version = req.query.version;
  const config={
    id : req.query.id,
    allQuestions: req.query.allQuestions || false
  }

  if (version === "1.0") {
    buildDOCX_1_WithCallback(config, function (binary, error, errorMsg, filename) {
      const id = config.id;
      var date = new Date();
      if (!error) {
        if (format === "json") {
          const resJSON = {
            id: "api.collection.print",
            ver: "1.0",
            ts: date.toISOString(),
            params: {
              id,
              format,
              status: "successful",
              err: null,
              errmsg: null,
            },
            responseCode: "OK",
            result: {
              content_id: id,
              base64string: binary,
              filename: filename,
            },
          };
          res.send(resJSON);
        } else {
          let fileName = encodeURIComponent(filename, "UTF-8");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=${fileName}.docx`
          );
          res.setHeader("Content-type", "text/docx; charset=utf-8");
          res.send(Buffer.from(binary, "base64"));
        }
      } else {
        res.status(404).send({
          error: errorMsg,
        });
      }
    });
  } else {
    buildDOCXWithCallback(config, function (binary, error, errorMsg, filename) {
      const id = config.id
      var date = new Date();
      if (!error) {
        if (format === "json") {
          const resJSON = {
            id: "api.collection.print",
            ver: "1.0",
            ts: date.toISOString(),
            params: {
              id,
              format,
              status: "successful",
              err: null,
              errmsg: null,
            },
            responseCode: "OK",
            result: {
              content_id: id,
              base64string: binary,
              filename: filename,
            },
          };
          res.send(resJSON);
        } else {
          let fileName = encodeURIComponent(filename, "UTF-8");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=${fileName}.docx`
          );
          res.setHeader("Content-type", "text/docx; charset=utf-8");
          res.send(Buffer.from(binary, "base64"));
        }
      } else {
        res.status(404).send({
          error: errorMsg,
        });
      }
    });
  }
}

async function printCSV(req, res) {
  const id = req.query.id;
  const format = req.query.format;

  console.log("CSV", req.body.path);
  buildCSVWithCallback(id, function (binary, error, errorMsg, filename) {
    var date = new Date();
    if (!error) {
      if (format === "json") {
        const resJSON = {
          id: "api.collection.print",
          ver: "1.0",
          ts: date.toISOString(),
          params: {
            id,
            format,
            status: "successful",
            err: null,
            errmsg: null,
          },
          responseCode: "OK",
          result: {
            content_id: id,
            base64string: binary,
          },
        };
        res.send(resJSON);
      } else {
        let fileName = encodeURIComponent(filename, "UTF-8");
        res.setHeader(
          "Content-disposition",
          `attachment; filename=${fileName}.csv`
        );
        res.setHeader("Content-type", "text/csv; charset=utf-8");
        res.send(binary);
      }
    } else {
      res.status(404).send({
        error: errorMsg,
      });
    }
  });
}
module.exports = function (app) {
  app
    .route(BASE_URL + "/print/docx")
    .get(
      requestMiddleware.gzipCompression(),
      requestMiddleware.createAndValidateRequestBody,
      printDocx
    );
  app
    .route(BASE_URL + "/print/csv")
    .get(
      requestMiddleware.gzipCompression(),
      requestMiddleware.createAndValidateRequestBody,
      printCSV
    );
};
