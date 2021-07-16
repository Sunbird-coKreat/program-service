const envVariables = require('../envVariables')
const learnerService = envVariables['SUNBIRD_LEARNER_SERVICE_URL']
const axios = require('axios');

class UserService {
  async getDikshaUserProfiles(req, identifier) {
    const option = {
      url: learnerService + 'user/v1/search',
      method: 'post',
      headers: { ...req.headers },
      data: {
        "request": {
          "filters": {
            "identifier": identifier
          }
        }
      }
    };
    console.log(`SUNBIRD_LEARNER_SERVICE_URL ${option.url}`)
    return axios(option);
  }
}

module.exports = UserService;
