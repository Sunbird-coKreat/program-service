const { getQuestionSet } = require("./dataImporter");
const docx = require("docx");
const { Packer } = docx;
const getDocx = require("../getdocxdata");

var {
  renderComprehension,
  renderMCQ,
  renderMTF,
  renderQuestion,
} = require("../docxHelper");

const buildDOCX_1_WithCallback = async (id, callback) => {
  let error = false;
  let errorMsg = "";
  let totalMarks = 0;
  getQuestionSet(id)
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
            //later remove this if condition
            if (question !== undefined) {

              questionCounter += 1;

              switch (question.qType) {
                case "MCQ":
                  questionContent = [
                    await renderMCQ(
                      question,
                      questionCounter,
                      question.maxScore
                    ),
                  ];
                  break;
                case "FTB":
                  questionContent = [
                    await renderQuestion(
                      question,
                      questionCounter,
                      question.maxScore,
                      "FTB"
                    ),
                  ];
                  break;
                case "SA":
                  questionContent = [
                    await renderQuestion(
                      question,
                      questionCounter,
                      question.maxScore,
                      "SA"
                    ),
                  ];
                  break;
                case "LA":
                  questionContent = [
                    await renderQuestion(
                      question,
                      questionCounter,
                      question.maxScore,
                      "LA"
                    ),
                  ];
                  break;
                case "VSA":
                  questionContent = [
                    await renderQuestion(
                      question,
                      questionCounter,
                      question.maxScore,
                      "VSA"
                    ),
                  ];
                  break;
                case "MTF":
                  questionContent = await renderMTF(
                    question,
                    questionCounter,
                    question.maxScore,
                    "MTF"
                  );
                  break;
                case "COMPREHENSION":
                  questionContent = [
                    await renderComprehension(
                      question,
                      questionCounter,
                      question.maxScore,
                      "COMPREHENSION"
                    ),
                  ];
                  break;
                case "CuriosityQuestion":
                  questionContent = [
                    await renderQuestion(
                      question,
                      questionCounter,
                      question.maxScore,
                      "CuriosityQuestion"
                    ),
                  ];
                  break;
              }
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
      error = true;
      errorMsg = "";
      callback(null, error, errorMsg);
    });
};

module.exports = {
  buildDOCX_1_WithCallback,
};
