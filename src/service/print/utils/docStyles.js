const styles = {
  header: {
    fontSize: 16,
    bold: true,
    alignment: "center",
    margin: [0, 10, 0, 5],
  },
  header_left: {
    fontSize: 14,
    bold: true,
    alignment: "left",
    margin: [0, 10, 0, 5],
  },
  header_right: {
    fontSize: 14,
    bold: true,
    alignment: "right",
    margin: [0, 10, 0, 5],
  },
  instruction: getInstructionStyle(),
  section_header: {
    fontSize: 12,
    bold: true,
    italics: true,
    margin: [0, 10, 0, 5],
  },
  question_MCQ: {
    fontSize: 12,
    margin: [5, 5, 0, 5],
  },
  question_FTB: {
    fontSize: 12,
    margin: [5, 5, 0, 5],
  },
  question_TF: {
    fontSize: 12,
    margin: [5, 5, 0, 5],
  },
  question_VSA: {
    fontSize: 12,
    margin: [5, 5, 0, 5],
  },
  question_SA: {
    fontSize: 12,
    margin: [5, 5, 0, 5],
  },
  question_LA: {
    fontSize: 12,
    margin: [5, 5, 0, 5],
  },
};

function getInstructionStyle() {
  return {
    fontSize: 12,
    bold: true,
    alignment: "left",
  };
}

module.exports = {
  styles,
  getInstructionStyle,
};
