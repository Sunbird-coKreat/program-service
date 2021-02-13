const { styles } = require("./docStyles");

const getStudentTeacherDetails = () => ({
  table: {
    widths: ["*", "*"],
    body: [
      [
        {
          border: [false, false, false, false],
          text: "Student Name ________________________",
          style: "header_left",
        },
        {
          border: [false, false, false, false],
          text: "Roll number ________________________",
          style: "header_left",
        },
      ],
      [
        {
          border: [false, false, false, false],
          text: "Teacher's name _______________________",
          style: "header_left",
        },
        {
          border: [false, false, false, false],
          text: "Teacher's Sign ______________________",
          style: "header_left",
        },
      ],
    ],
  },
});

const getExamName = (examName) => ({
  text: examName,
  style: "header",
});

const getGradeHeader = (grade) => ({
  text: `Grade - ${grade}`,
  style: "header",
});

const docDefinition = {
  content: [],
  styles: styles,
};

function getLA() {
  return {
    text: "21. What advice did the old bird give to the other birds?",
    style: "question_LA",

    table: {
      widths: ["*"],
      body: [
        [
          {
            border: [false, false, false, false],
            text: "21. What advice did the old bird give to the other birds?",
            style: "question_LA",
          },
        ],
        [
          {
            border: [false, false, false, false],
            text:
              "____________________________________________________________________________________________\n\n____________________________________________________________________________________________\n\n____________________________________________________________________________________________\n\n____________________________________________________________________________________________\n\n____________________________________________________________________________________________\n\n____________________________________________________________________________________________\n\n____________________________________________________________________________________________\n\n____________________________________________________________________________________________\n\n____________________________________________________________________________________________\n\n____________________________________________________________________________________________\n\n____________________________________________________________________________________________",
            style: "question_VSA",
          },
        ],
      ],
    },
  };
}

function getVSA(questionTitle, language, marks) {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            border: [false, false, false, false],
            text: questionTitle,
            style: "question_VSA",
            font: language,
          },
        ],
        [
          {
            border: [false, false, false, false],
            text:
              "____________________________________________________________________________________________",
            style: "question_VSA",
          },
        ],
      ],
    },
  };
}

function getSA(questionTitle, language, marks) {
  return {
    // Time + Marks
    table: {
      widths: ["*", "auto"],
      body: [
        [
          {
            border: [false, false, false, false],
            // Question SA
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    border: [false, false, false, false],
                    text: questionTitle,
                    style: "question_SA",
                    font: language,
                  },
                ],
                [
                  {
                    border: [false, false, false, false],
                    text:
                      "______________________________________________________________________________________\n\n______________________________________________________________________________________\n\n______________________________________________________________________________________",
                    style: "question_VSA",
                  },
                ],
              ],
            },
          },
          {
            border: [false, false, false, false],
            text: marks,
            style: "header_right",
          },
        ],
      ],
    },
  };
}

function getTF(questionTitle, language, marks) {
  return {
    table: {
      widths: ["auto", 50],
      body: [
        [
          {
            border: [false, false, false, false],
            text: questionTitle,
            style: "question_TF",
            font: language,
          },
          {
            border: [true, true, true, true],
            text: "",
            style: "question_TF",
          },
        ],
      ],
    },
  };
}

function getFTB(questionTitle, language, marks) {
  return {
    // Time + Marks
    table: {
      widths: ["*", "auto"],
      body: [
        [
          {
            border: [false, false, false, false],
            text: questionTitle,
            style: "question_FTB",
            font: language,
          },
          {
            border: [false, false, false, false],
            text: marks,
            style: "header_right",
          },
        ],
      ],
    },
  };
}

function getMCQ(questionTitle, questionOptions, language, marks) {
  console.log({ marks });
  return {
    table: {
      widths: ["*", "auto"],
      body: [
        [
          {
            border: [false, false, false, false],
            table: {
              widths: ["*", "*", "*", "*"],
              body: [
                [
                  {
                    border: [false, false, false, false],
                    text: {
                      text: questionTitle,
                      style: "question_MCQ",
                      font: language,
                    },
                    colSpan: 4,
                  },
                  {},
                  {},
                  {},
                ],
                [
                  {
                    border: [false, false, false, false],
                    text: "1. " + questionOptions[0],
                    style: "question_MCQ",
                    font: language,
                  },
                  {
                    border: [false, false, false, false],
                    text: "2. " + questionOptions[1],
                    style: "question_MCQ",
                    font: language,
                  },
                  {
                    border: [false, false, false, false],
                    text: "3. " + questionOptions[2],
                    style: "question_MCQ",
                    font: language,
                  },
                  {
                    border: [false, false, false, false],
                    text: "4. " + questionOptions[3],
                    style: "question_MCQ",
                    font: language,
                  },
                ],
              ],
            },
          },
          {
            border: [false, false, false, false],
            text: marks,
            style: "header_right", //Marsk will be dynamic
          },
        ],
      ],
    },
  };
}

function getSectionTitle(sectionTitle, language) {
  return {
    text: sectionTitle,
    style: "section_header",
    font: language,
  };
}

function getInstructions(instructions, language) {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            border: [false, true, false, true],
            text: instructions,
            font: language,
            style: "instruction",
          },
        ],
      ],
    },
  };
}

function getTimeAndMarks() {
  return {
    table: {
      widths: ["*", "*"],
      body: [
        [
          {
            border: [false, false, false, false],
            text: "Time - " + "90" + "Minutes",
            style: "header_left",
          },
          {
            border: [false, false, false, false],
            text: "Marks - " + "100",
            style: "header_right",
          },
        ],
      ],
    },
  };
}

function getSubject(subject) {
  return {
    text: `Subject - ${subject}`,
    style: "header",
  };
}

module.exports = {
  docDefinition,
  getStudentTeacherDetails,
  getExamName,
  getGradeHeader,
  getSubject,
  getTimeAndMarks,
  getInstructions,
  getSectionTitle,
  getMCQ,
  getFTB,
  getTF,
  getSA,
  getVSA,
  getLA,
};
