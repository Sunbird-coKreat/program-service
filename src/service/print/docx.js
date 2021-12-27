const { getData } = require("./dataImporter");
const docx = require("docx");
const fetch = require("node-fetch");
const { Packer } = docx;
const getDocx = require("./getdocxdata");
var {
  renderComprehension,
  renderMCQ,
  renderMTF,
  renderQuestion,
} = require("./docxHelper");

const buildDOCXWithCallback = async (id, callback) => {
    let error = false;
  let errorMsg = "";
  let totalMarks = 0;
  getData(id)
    .then(async (data) => {
      if (data.error) {
        callback(null, data.error, data.errorMsg);
      } else {
        let subject, grade, examName, instructions, language, description;
        if (data.paperData) {
          subject = data.paperData.subject && data.paperData.subject[0];
          grade = data.paperData.gradeLevel && data.paperData.gradeLevel[0];
          examName = data.paperData.name;
          instructions = data.paperData.description;
          language = data.paperData.medium && data.paperData.medium[0];
        }
        data.sectionData.forEach((d) => {
          d.questions.forEach((element, index) => {
            const marks = parseInt(element.marks);
            if (!isNaN(marks)) totalMarks += marks;
          });
        });

        const questionPaperContent = [];
        const paperDetails = {
          examName: examName,
          className: grade,
          subject: subject,
          instructions: instructions.split(/\n/),
        };
        let questionCounter = 0;

        for (const d of data.sectionData) {
          const section = d.section.name;
          let questionContent;
          questionContent = [{ sectionHeader: section, type: "section" }];
          questionPaperContent.push(questionContent);

          for (const [index, question] of d.questions.entries()) {
            questionCounter += 1;

            switch (question.category) {
              case "MCQ":
                questionContent = [
                  await renderMCQ(question, questionCounter, question.marks,),
                ];
                break;
              case "FTB":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "FTB"
                  ),
                ];
                break;
              case "SA":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "SA"
                  ),
                ];
                break;
              case "LA":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "LA"
                  ),
                ];
                break;
              case "VSA":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "VSA"
                  ),
                ];
                break;
              case "MTF":
                questionContent = [await renderMTF(
                  question,
                  questionCounter,
                  question.marks,
                  "MTF"
                ),
                ];
                break;
              case "COMPREHENSION":
                questionContent = [
                  await renderComprehension(
                    question,
                    questionCounter,
                    question.marks,
                    "COMPREHENSION"
                  ),
                ];
                break;
              case "CuriosityQuestion":
                questionContent = [
                  await renderQuestion(
                    question,
                    questionCounter,
                    question.marks,
                    "CuriosityQuestion"
                  ),
                ];
                break;
            }
            questionPaperContent.push(questionContent);
          }
        }
        const doc = await getDocx.create(questionPaperContent, paperDetails);

        const b64string = await Packer.toBase64String(doc);
        let filename = grade + "_" + subject + "_" + examName;
        filename = filename.replace(/\s/g, "");
        callback(b64string, null, null, filename);
      }
    })
    .catch((e) => {
      console.log(e);
      error = true;
      errorMsg = "";
      callback(null, error, errorMsg);
    });
};

module.exports = {
  buildDOCXWithCallback,
};
