const fetch = require("node-fetch");
const envVariables = require("../../envVariables");

class PDFDataImportError {
  constructor(message) {
    this.message = message;
    this.name = "PDFDataImportError";
  }
}

function getItemsFromItemset(itemsetID,marks) {
  let status;
  const urlItemset = `${envVariables.baseURL}/action/itemset/v3/read/${itemsetID}`;
  return fetch(urlItemset)
    .then((r2) => {
      status = r2.status;
      return r2.json();
    })
    .then((r) => {
      if (status === 200) {
        if (r.result.itemset.items.length > 0) {
          const item = r.result.itemset.items[0];
          return getQuestionFromItem(item.identifier,marks);
        } else {
          throw new PDFDataImportError("Empty Itemset");
        }
      } else {
        throw new PDFDataImportError(
          "Invalid Response for Itemset ID :: " + itemsetID
        );
      }
    })
    .catch((e) => {
      if (e.name === "PDFDataImportError") throw e;
      else throw new PDFDataImportError("Invalid Response for Itemset API");
    });
}

function getQuestionFromItem(itemID,marks) {
  let status;
  const urlItem = `${envVariables.baseURL}/action/assessment/v3/items/read/${itemID}`;
  return fetch(urlItem)
    .then((r3) => {
      status = r3.status;
      return r3.json();
    })
    .then((r) => {
      if (status === 200) {
        if (r.result.assessment_item) {
          r.result.assessment_item.marks = marks
          return r.result.assessment_item;
        }
        else throw "Not a valid question";
      } else {
        throw new PDFDataImportError(
          "Invalid Response for Question ID :: " + itemID
        );
      }
    })
    .catch((e) => {
      if (e.name === "PDFDataImportError") throw e;
      else throw new PDFDataImportError("Invalid Response for Question API");
    });
}

const getQuestionForSection = async (id) => {
  const url = `${envVariables.baseURL}/action/content/v3/hierarchy/${id}?mode=edit`;
  let status;
  return fetch(url)
    .then((r1) => {
      status = r1.status;
      return r1.json();
    })
    .then((r) => {
      if (status === 200) {
        if (r.result.content.itemSets && r.result.content.itemSets.length > 0) {
          const itemset = r.result.content.itemSets[0];
          // console.log("Marks dataImports:", r.result.content.marks)
          const marks = r.result.content.marks;
          // return { marks: marks, ...getItemsFromItemset(itemset.identifier) }
          return getItemsFromItemset(itemset.identifier,marks);
        } else {
          throw new PDFDataImportError("Empty Section");
        }
      } else {
        throw new PDFDataImportError(
          "Invalid Response for Hierarchy ID :: " + id
        );
      }
    })
    .catch((e) => {
      error = true;
      if (e.name === "PDFDataImportError");
      else e.message = "Uncaught Exception";
      let errorMsg = e.message
      return {
        error,
        errorMsg,
      };
    });
};

const getData = async (id) => {
  let error = false;
  let errorMsg = "";
  const url = `${envVariables.baseURL}/action/content/v3/hierarchy/${id}?mode=edit`;
  return fetch(url)
    .then((r4) => r4.json())
    .then((r) => {
      const data = r.result.content;
      let sections;
      if (data && "children" in data) sections = data.children;
      else {
        throw new PDFDataImportError("Invalid ID");
      }

      const questionIds = sections.map((section) => {
        if (section.children)
          return section.children
            .filter(
              (child) =>
                data.acceptedContents &&
                data.acceptedContents.indexOf(child.identifier) > -1
            )
            .map((child) => child.identifier);
        else return [];
      }); // Hierarchy

      // question_ids=[[s1.q1.id , s1.q2.id],[s2.q1.id, s2.q2.id]]
      const promiseMap = questionIds.map((sec) =>
        sec.map((question) =>
          getQuestionForSection(question).then((resp) => {
            if (resp.error) {
              throw new PDFDataImportError(resp.errorMsg);
            } else return resp;
          })
        )
      );

      const questionPromises = promiseMap.map((sectionPromise, index) =>
        Promise.all(sectionPromise)
          .then((result) => result)
          .catch((e) => {
            throw e;
          })
      );
      return Promise.all(questionPromises).then((results) => {
        const sectionData = results.map((questions, index) => {
          return {
            section: sections[index],
            questions: questions,
          };
        });
        return {
          sectionData,
          paperData: data,
          error,
          errorMsg,
        };
      });
    })
    .catch((e) => {
      console.log(e);
      error = true;
      if (e.name === "PDFDataImportError") errorMsg = e.message;
      else errorMsg = "Uncaught Exception";
      return {
        error,
        errorMsg,
      };
    });
};

module.exports = {
  getData,
};
