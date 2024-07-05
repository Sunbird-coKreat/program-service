# Installing Contribution/Program Service on Local Laptop or Desktop

## Pre-requisites

1. Before you install program service on your laptop, examine your environment and gather data to ensure an optimal installation experience. Review the [details](https://sunbird.gitbook.io/sunbird-cokreat-1/use/developer-guide/contribution-service/contribution-service) to ensure that the environment has the necessary resources and compliant target systems to successfully install and run Program Service.

2. Program service uses Postgres database to store and manage data. Refer [programs.sql](https://github.com/Sunbird-Ed/program-service/blob/master/programs.sql) for the database and table structure, You need to run the program.sql file in postgrase DB to set the table structure.

## Project Setup

1. Clone the project
    - Fork the [main source code repository](https://github.com/Sunbird-Ed/program-service)
    - Clone the forked repository and add main source code repository as upstream

    ```console
        git clone {SSH URL of FORKED REPOSITORY}
        cd {PROJECT-FOLDER}
        git remote add upstream git@github.com:Sunbird-Ed/program-service.git
        git fetch upstream
        git checkout -b {LOCAL-BRANCH-NAME} upstream/{LATEST BRANCH}
    ```
    > ***Note***: Stable versions of the program service are available via tags for each release, and the master branch contains latest stable release. For latest stable release [refer](https://github.com/Sunbird-Ed/program-service/branches)

2. Install Git Submodules to make use of https://github.com/project-sunbird/sunbird-js-utils.git

    ```console
        cd {PROJECT-FOLDER}
        git submodule init
        git submodule update
    ```
3. Install required dependencies

    ```console
        cd {PROJECT-FOLDER}/src
        npm install
    ```

4. Configuring the Environment
   - Open the file `{PROJECT-FOLDER}/src/envVariables.js` in any available text editor and update the contents of the file so that it contains exactly the following values

    ```console
    const envVariables = {
    baseURL: process.env.dock_base_url || <'https://<host for adopter's instance'>,
    SUNBIRD_URL: process.env.sunbird_base_url || <'https://<host for adopter's instance'>,
    ....
    config: {
        user: process.env.sunbird_program_db_user || "<postgress user>",
        host: process.env.sunbird_program_db_host || "localhost",
        database: process.env.sunbird_program_db_name || 'sunbird_programs',
        password: process.env.sunbird_program_db_password || '<postgress password>',
       ....
    },
    }
    ```

    > Once the file is updated with appropriate values, then you can proceed with running the application

### Running Application

1. Run the following command in the **{PROJECT-FOLDER}/src** folder

```console
    node app.js
```

2. The local HTTP server is launched at `http://localhost:6000`
