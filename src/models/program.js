module.exports = function(sequelize, DataTypes) {
  const program = sequelize.define("program", {
    program_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    type: {
      type: DataTypes.ENUM("public", "private", "restricted"),
      allowNull: false
    },
    collection_ids: {
      type: DataTypes.ARRAY(DataTypes.TEXT)
    },
    content_types: {
      type: DataTypes.ARRAY(DataTypes.TEXT)
    },
    target_collection_category: {
      type: DataTypes.ARRAY(DataTypes.TEXT)
    },
    targetprimarycategories: {
      type: DataTypes.JSONB
    },
    targetprimarycategorynames: {
      type: DataTypes.ARRAY(DataTypes.TEXT)
    },
    target_type: {
      type: DataTypes.STRING
    },
    startdate: {
      type: DataTypes.DATE
    },
    enddate: {
      type: DataTypes.DATE
    },
    nomination_enddate: {
      type: DataTypes.DATE
    },
    shortlisting_enddate: {
      type: DataTypes.DATE
    },
    content_submission_enddate: {
      type: DataTypes.DATE
    },
    image: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.ENUM("Draft", "Live"),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING
    },
    config: {
      type: DataTypes.JSON,
      allowNull: false
    },
    rolemapping: {
      type: DataTypes.JSON
    },
    createdby: {
      type: DataTypes.STRING
    },
    updatedby: {
      type: DataTypes.STRING
    },
    createdon: {
      type: DataTypes.DATE
    },
    updatedon: {
      type: DataTypes.DATE
    },
    rootorg_id: {
      type: DataTypes.STRING
    },
    sourcing_org_name: {
      type: DataTypes.STRING
    },
    channel: {
      type: DataTypes.TEXT,
      defaultValue: 'DIKSHA'
    },
    template_id: {
      type: DataTypes.TEXT
    },
    guidelines_url: {
      type: DataTypes.TEXT
    },
    acceptedcontents: {
      type: DataTypes.ARRAY(DataTypes.TEXT)
    },
    rejectedcontents: {
      type: DataTypes.ARRAY(DataTypes.TEXT)
    },
    sourcingrejectedcomments: {
      type: DataTypes.JSONB
    }
  }, {
      timestamps: false,
      freezeTableName: true
  });
  return program;
};
