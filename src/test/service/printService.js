process.env.NODE_ENV = "test";

const envVariables = require("../../envVariables");
const chai = require("chai");
const chaiHttp = require("chai-http");
chai.use(chaiHttp);
const { expect } = chai;
chai.use(require("chai-sorted"));
chai.use(require("chai-match"))
const _ = require("lodash");

const programData = require("../testData/program.json");
const dummyData = require("../testData/dummyData");

const BASE_URL = "/program/v1";
var rewire = require("rewire");
const { getData } = require("../../service/print/dataImporter");
const dataImporter = rewire("../../service/print/dataImporter.js");
const dataImporter1 = rewire(
  "../../service/print/printDocx-1.0/dataImporter.js"
);

const docx = rewire("../../service/print/docx.js");
const docx1 = rewire("../../service/print/printDocx-1.0/docx.js");

const getQuestionForSection = dataImporter.__get__("getQuestionForSection");
const getItemsFromItemset = dataImporter.__get__("getItemsFromItemset");
const getQuestionFromItem = dataImporter.__get__("getQuestionFromItem");
const getQuestionSet = dataImporter1.__get__("getQuestionSet");
const getQuestionForSet = dataImporter1.__get__("getQuestionForSet");

var cheerio = require("cheerio");
var cheerioTableparser = require("cheerio-tableparser");

// eslint-disable-next-line no-undef
describe("Print Service", () => {
  it("[Integration test] should output error for wrong heirarchy ID", (done) => {
    getQuestionForSection("test").then((res) => {
      expect(res.error).to.equal(true);
      expect(res.errorMsg).to.equal(
        "Invalid Response for Hierarchy ID :: test"
      );
      done();
    });
  });

  it("[Integration test] should respond with question data for correct ID", (done) => {
    getQuestionForSection("do_11341784380642918411536")
      .then((response) => {
        expect(response).to.not.be.undefined;
        expect(response.itemType).to.equal("UNIT");
        expect(response).to.have.property("itemType");
        done();
      })
      .catch((e) => {
        done(e);
      });
  });

  it("[Integration test] should get Items from itemset for correct itemset ID", (done) => {
    getItemsFromItemset("do_1134178438144573441157")
      .then((response) => {
        expect(response).to.not.be.undefined;
        done();
      })
      .catch((e) => {
        done(e);
      });
  });

  it("[Integration test] should throw DocxDataImportError from itemset for incorrect itemset ID", (done) => {
    getItemsFromItemset("any")
      .then((response) => {
        expect(response.error).to.be.equal(true);
        done()
      })
      .catch((e) => {
        expect(e.name).to.equal("DocxDataImportError");
        expect(e.message).to.equal("Invalid Response for Itemset ID :: any");
        done();
      });
  });

  it("[Integration test] should throw DocxDataImportError for incorrect item ID", (done) => {
    getQuestionFromItem("any")
      .then((response) => {
        expect(response.error).to.be.equal(true);
        done();
      })
      .catch((e) => {
        expect(e.name).to.equal("DocxDataImportError");
        expect(e.message).to.equal("Invalid Response for Question ID :: any");
        done();
      });
  });

  it("[Integration test] should return Question Object for correct item ID", (done) => {
    getQuestionFromItem("do_1134178438125649921264")
      .then((response) => {
        expect(response).to.not.be.undefined;
        done();
      })
      .catch((e) => {
        done(e);
      });
  });

  it("[Integration test] should getData for correct Hierarchy ID", (done) => {
   getData("do_11341790341271552011559")
      .then((response) => {
        expect(response).to.not.be.undefined;
        expect(response).to.have.property("paperData");
        expect(response).to.have.property("sectionData");
        expect(response.sectionData).to.be.an("Array");
        expect(response.sectionData[0].questions).to.be.an("Array");
        expect(response.sectionData[0].section).to.be.an("Object");
        expect(response).to.have.property("error");
        expect(response.error).to.be.false;
        done();
      })
      .catch((e) => {
        done(e);
      });
  });

  it("[Integration test] should return a docx for correct Hierarchy ID", (done) => {
    docx.buildDOCXWithCallback(
      "do_11341790341271552011559",
      (base64, error, errorMsg) => {
        expect(error).to.be.null;
        expect(errorMsg).to.be.null;
        done();
      }
    );
  });

  it("[Integration test] should return a an error for incorrect Hierarchy ID", (done) => {
    docx.buildDOCXWithCallback("any", (base64, error, errorMsg) => {
      expect(error).to.be.true;
      expect(errorMsg).to.equal("Invalid ID");
      done();
    });
  });

  it("[Integration test] should return and error for incorrect Item ID", (done) => {
    getQuestionFromItem("do_1132132526040596481722")
      .then((response) => {
        expect(response).to.not.be.undefined;
        done();
      })
      .catch((e) => {
        done(e);
      });
  });

  it("[Integration test] should return Question Object for correct questions set ID for docx1.0", (done) => {
    getQuestionSet("do_113431918093377536172")
      .then((response) => {
        expect(response).to.not.be.undefined;
        done();
      })
      .catch((e) => {
        done(e);
      });
  });
  it("[Integration test] docx1.0 should return and error for incorrect Hierarchy ID", (done) => {
    getQuestionSet("do_11341847729268326411897")
      .then((response) => {
        expect(response).to.not.be.undefined;
        done();
      })
      .catch((e) => {
        expect(e.name).to.equal("DocxDataImportError");
        expect(e.message).to.equal("Invalid Response for Itemset ID :: any");
        done();
      });
  });

  it("[Integration test] should return Question Object for correct question ID docx1.0", (done) => {
    getQuestionForSet("do_113431952169918464189")
      .then((response) => {
        expect(response).to.not.be.undefined;
        done();
      })
      .catch((e) => {
        done(e);
      });
  });
  it("[Integration test] docx1.0 should return and error for incorrect question ID", (done) => {
    getQuestionForSet("test")
      .then((response) => {
        expect(response.error).to.be.equal(true);
        done();
      })
      .catch((e) => {
        expect(e.name).to.equal("DocxDataImportError");
        done();
      });
  });

  it("[Integration test] docx1.0 should getQuestionSet for correct Hierarchy ID", (done) => {
    getQuestionSet("do_113431918093377536172")
      .then((response) => {
        expect(response).to.not.be.undefined;
        expect(response).to.have.property("paperData");
        expect(response).to.have.property("sectionData");
        expect(response.sectionData).to.be.an("Array");
        expect(response.sectionData[0].questions).to.be.an("Array");
        done();
      })
      .catch((e) => {
        done(e);
      });
  });
  it("[Integration test] should return a docx1.0 for correct Hierarchy ID", (done) => {
    docx1.buildDOCX_1_WithCallback(
      "do_113431918093377536172",
      (base64, error, errorMsg) => {
        expect(error).to.be.null;
        expect(errorMsg).to.equal(null);
        done();
      }
    );
  });

  it("[Integration test] should return a an error for incorrect Hierarchy ID", (done) => {
    docx1.buildDOCX_1_WithCallback("any", (base64, error, errorMsg) => {
      expect(error).to.be.true;
      expect(errorMsg).to.equal("");
      done();
    });
  });
  it("Should parse table", (done) => {
    const table = `<p>Match the following:</p><figure class="table"><table><tbody><tr><td><strong>Column 1</strong></td><td><strong>Column 2</strong></td></tr><tr><td>1</td><td>1</td></tr></tbody></table></figure>`;
    $ = cheerio.load(table);
    cheerioTableparser($);
    var data = [];
    var columns = $("table").parsetable(false, false, false);
    const transposeColumns = columns[0].map((_, colIndex) =>
      columns.map((row) => row[colIndex])
    );
    const heading = $("p").text();

    console.log(heading);
    done();
  });
});
