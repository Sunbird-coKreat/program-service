var express = require("express");
const { buildDOCXWithCallback } = require('../service/print/docx')

const { buildDOCX_1_WithCallback } = require('../service/print/printDocx-1.0/docx')

const requestMiddleware = require("../middlewares/request.middleware");
// const base64 = require('base64topdf');
const BASE_URL = "/program/v1";
// Refactor this to move to service
async function printDocx(req,res){
  const id = req.query.id;
  const format = req.query.format;
  const version = req.query.version;
  console.log("Version:",version)

  if(version === "1.0"){
    console.log("Entered 1.0")
    buildDOCX_1_WithCallback(id,function (binary, error, errorMsg,filename) {
      // console.log("Enttere dres")
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
              filename: filename
            },
          };
          res.send(resJSON);
        } else {
          
          res.setHeader('Content-Disposition', `attachment; filename=${filename}.docx`);
          res.send(Buffer.from(binary, 'base64'));
        }
      } else {
        res.status(404).send({
          error: errorMsg,
        }); 
      }

    });
  } else {
  // buildDOCXwithCallback(function (binary, error, errorMsg) {
    console.log("Entered 0.5")
    buildDOCXWithCallback(id,function (binary, error, errorMsg,filename) {
    // console.log("Enttere dres")
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
            filename: filename
          },
        };
        res.send(resJSON);
      } else {
        
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.docx`);
        res.send(Buffer.from(binary, 'base64'));
      }

    } else {
      res.status(404).send({
        error: errorMsg,
      }); 
    }
  });
}

}

// async function printxml(req,res){
//   const id = req.query.id;
//   const format = req.query.format;
//   // buildDOCXwithCallback(function (binary, error, errorMsg) {
//     buildXmessageWithCallback(id,function (binary, error, errorMsg,filename) {
//     // console.log("Enttere dres")
//     var date = new Date();
//     if (!error) {
//       if (format === "json") {
//         const resJSON = {
//           id: "api.collection.print",
//           ver: "1.0",
//           ts: date.toISOString(),
//           params: {
//             id,
//             format,
//             status: "successful",
//             err: null,
//             errmsg: null,
//           }, 
//           responseCode: "OK",
//           result: {
//             content_id: id,
//             base64string: binary,
//             filename: filename
//           },
//         };
//         res.send(resJSON);
//       } else {
        
//         res.setHeader('Content-Disposition', `attachment; filename=${filename}.xml`);
//         res.setHeader('Content-type', 'application/xml');
//         res.send(Buffer.from(binary, 'base64'));
//       }
//     } else {
//       res.status(404).send({
//         error: errorMsg,
//       }); 
//     }
//   });
// }




module.exports = function (app) {
  app
    .route(BASE_URL + "/print/docx")
    .get(
      requestMiddleware.gzipCompression(),
      requestMiddleware.createAndValidateRequestBody,
      printDocx
    );
    
};