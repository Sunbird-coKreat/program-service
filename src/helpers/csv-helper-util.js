const _ = require("lodash");
const Papa = require("papaparse");
global.XMLHttpRequest = require('xhr2');
class CSVFileValidator {
    // csvFile = null;
    // csvData = null;
    // config = null;
    // allowedDynamicColumns = null;
    // flattenHierarchyObj = null;
    // response = null;

    /**
     * @param {Object} config
     */
    constructor(config, allowedDynamicColumns, flattenHierarchyObj = {}) {

        this.config = config;
        this.allowedDynamicColumns = allowedDynamicColumns;
        this.flattenHierarchyObj = flattenHierarchyObj;
    }

    /**
     * @param {Object} object
     * @param {String} key
     * @param {String} message
     * @param {Array} data
     * @private
     */
    handleError(object, key, message, data) {
        if (_.isFunction(_.get(object, key))) {
            object[key](...data);
        } else {
            this.response.inValidMessages.push(message);
        }
        return this.response;
    }    

    /**
     * @private
     */
    prepareDataAndValidateFile() {
        const expectedColumns = this.config.headers.length;
        const foundColumns = this.csvData[0].length;
        // Check if extra columns are present other than specified
        if (foundColumns > expectedColumns) {
            const invalidColumns = _.map(_.range(expectedColumns, foundColumns), (number) => this.csvData[0][number] || `Column ${number}`)
            return this.handleError(this.config, 'extraHeaderError', `Invalid data found in columns: ${invalidColumns.join(',')}`, [invalidColumns, expectedColumns, foundColumns]);
        }

        // One row for headers
        const actualRows = this.csvData.length - 1;

        // Empty rows or file validation
        if (actualRows === 0) {
            return this.handleError(this.config, 'noRowsError', `Empty rows found in the file`, []);
        }

        // Minimum rows validation
        const minRows = _.get(this.config, 'minRows', 0);
        if (minRows > 0 && (minRows > actualRows)) {
            return this.handleError(this.config, 'minRowsError', `Expected min ${minRows} rows but found ${actualRows} rows in the file`, [minRows, actualRows]);
        }

        // Maximum rows validation
        const maxRows = _.get(this.config, 'maxRows', 0);
        if (maxRows > 0 && (maxRows < actualRows)) {
            return this.handleError(this.config, 'maxRowsError', `Expected max ${maxRows} rows but found ${actualRows} rows in the file`, [maxRows, actualRows]);
        }

        // Required headers validation
        const headers = this.config.headers;
        const csvHeaders = _.first(this.csvData);
        const headerNames = headers.map(row => {
           row.name = _.get(row, 'name', '').trim();
           return row.name;
        });

        // Missing headers
        let difference = headerNames
            .filter(x => !csvHeaders.includes(x))
            .concat(csvHeaders.filter(x => !headerNames.includes(x)));

        if (difference.length > 0) {
            difference.map((column) => {
                const valueConfig = headers.find(row => row.name === column);
                if (valueConfig) {
                    return this.handleError(valueConfig, 'headerError', `${column} header is missing`, [column]);
                }
            });
        }

        const uniqueValues = {};

        // Iterate over each row in csv file
        this.csvData.forEach((row, rowIndex) => {
            // First row is headers so skip it
            if (rowIndex === 0) return;

            // No more rows in the file
            if ((row.length < headers.length)) {
                return ;
            }

            const rowData = {};
            let hasError = false;

            // Iterate over each column (header) in a row
            headers.forEach((valueConfig, columnIndex) => {
                // If header is not present
                if (!valueConfig) {
                    return;
                }

                // Get the column (header) value
                let columnValue = (row[columnIndex] || '').trim();

                // Default validation
                if (valueConfig.isDefault && !columnValue) {
                    columnValue = valueConfig.default;
                }

                const maxLength = _.get(valueConfig, 'maxLength', -1);

                // Max length validation
                if (typeof(columnValue) === 'string' && maxLength > -1) {
                    if (columnValue.length > maxLength) {
                        this.handleError(valueConfig, 'maxLengthError', `${valueConfig.name} contains more than ${maxLength} characters at row: ${rowIndex + 1}`, [valueConfig.name, rowIndex + 1, columnIndex + 1, maxLength, columnValue.length]);
                        hasError = true;
                        return;
                    }
                }


                //  Required column value validation
                if (valueConfig.required && !columnValue.length) {
                    this.handleError(valueConfig, 'requiredError', `${valueConfig.name} is required in the (${rowIndex + 1}) row / (${columnIndex + 1}) column`, [valueConfig.name, rowIndex + 1, columnIndex + 1]);
                    hasError = true;
                    return;
                }

                // Custom column (header) validation
                if (valueConfig.validate && !valueConfig.validate(columnValue)) {
                    this.handleError(valueConfig, 'validateError', `${valueConfig.name} is not valid in the (${rowIndex + 1}) row / (${columnIndex + 1}) column`, [valueConfig.name, rowIndex + 1, columnIndex + 1]);
                    hasError = true;
                    return;
                }

                // Unique validation
                if (valueConfig.unique) {
                    const inputName = _.get(valueConfig, 'inputName');
                    uniqueValues[inputName] = _.get(uniqueValues, `${inputName}`, []);

                    // If value not present in array
                    if (!uniqueValues[inputName].includes(columnValue)) {
                        uniqueValues[inputName].push(columnValue);
                    } else {
                        this.handleError(valueConfig, 'uniqueError', `${valueConfig.name} has duplicate value in the (${rowIndex + 1}) row / (${columnIndex + 1}) column`, [valueConfig.name, rowIndex + 1, columnIndex + 1, columnValue]);
                        hasError = true;
                        return;
                    }
                }

                // Optional validation
                if (valueConfig.optional) {
                    rowData[valueConfig.inputName] = columnValue;
                }

                // Url validation
                if (valueConfig.isUrl && !_.isEmpty(columnValue)) {
                    const urlPattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
                    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
                    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
                    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
                    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
                    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
                    const isUrl = !!urlPattern.test(columnValue);
                    if (!isUrl) {
                        this.handleError(valueConfig, 'urlError', `${valueConfig.name} has invalid url at (${rowIndex + 1}) row / (${columnIndex + 1}) column`, [valueConfig.name, rowIndex + 1, columnIndex + 1, columnValue]);
                        hasError = true;
                        return;
                    }
                }

                // speacial character validation
                if (valueConfig.isSpecialChar && !_.isEmpty(columnValue)) {
                    const specialChars = "!`~@#$^*+=[]\\\'{}|\"<>%/";
                    const isSpecialCharsPresent = specialChars.split('').some(char => 
                        columnValue.includes(char));
                    if (isSpecialCharsPresent) {
                        this.handleError(valueConfig, 'specialCharError', `${valueConfig.name} has special character at (${rowIndex + 1}) row / (${columnIndex + 1}) column`, [valueConfig.name, rowIndex + 1, columnIndex + 1, columnValue]);
                        hasError = true;
                        return;
                    }
                }

                // Array validation
                if (valueConfig.isArray) {
                    rowData[valueConfig.inputName] = _.isEmpty(columnValue) ? [] : columnValue.split(',')
                        .map((value) => value.trim());
                } else {
                    rowData[valueConfig.inputName] = columnValue;
                }

                const inValues = _.get(valueConfig, 'in', []);

                // In values validation
                if (!_.isEmpty(inValues) && !valueConfig.isDefault) {
                    const lowerValues = inValues.map((v) => _.toLower(v));
                    if (!lowerValues.includes(_.toLower(columnValue))) {
                        this.handleError(valueConfig, 'inError', `${valueConfig.name} has invalid value at row: ${rowIndex + 1}`, [valueConfig.name, rowIndex + 1, columnIndex + 1, valueConfig.in, columnValue]);
                        hasError = true;
                        return;
                    }
                }
            });

            // Custom row validation
            if (_.isFunction(this.config.validateRow)) {
                this.config.validateRow(rowData, rowIndex + 1, this.flattenHierarchyObj);
            }

            if (hasError) {
                return;
            }

            // Push the rowData
            this.response.data.push(rowData);
        });

        // Return response
        return this.response;
    }

    /**
     * @param {File} csvFile
     * @private
     */
    validate(csvFilePath) {
        this.csvFile = csvFilePath;
        this.response = {
            inValidMessages: [],
            data: []
        };

        return new Promise((resolve, reject) => {
            Papa.parse(csvFilePath, {
                download: true,
                complete: (results, file) => {
                    this.csvData = results.data;
                    const dynamicHeaders = !_.isEmpty(this.allowedDynamicColumns) ? // 10
                    [...this.config.headers, ..._.filter(this.allowedDynamicColumns, columns => {
                        return _.includes(_.first(this.csvData), columns.name);
                    })] : [...this.config.headers];
                    this.config.headers = _.uniqBy(dynamicHeaders, 'inputName');
                    resolve(this.prepareDataAndValidateFile());
                },
                error: (error, file) => {
                    reject({ error: error, file: file });
                }
            });
        });
    }
}

module.exports = CSVFileValidator;