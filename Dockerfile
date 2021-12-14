FROM ubuntu:20.04
MAINTAINER "Kartheek Palla" "kartheekp@ilimi.in"
RUN apt update && apt install -y wget
RUN wget -q https://nodejs.org/download/release/v8.11.2/node-v8.11.2-linux-x64.tar.gz
RUN tar -xf node-v8.11.2-linux-x64.tar.gz
RUN ln -s /node-v8.11.2-linux-x64/bin/node /usr/local/bin/node
RUN ln -s /node-v8.11.2-linux-x64/bin/npm /usr/local/bin/npm
RUN ln -s /node-v8.11.2-linux-x64/bin/npx /usr/local/bin/npx
RUN npm install -g yarn
RUN ln -s /node-v8.11.2-linux-x64/bin/yarn /usr/local/bin/yarn
RUN ln -s /node-v8.11.2-linux-x64/bin/yarnpkg /usr/local/bin/yarnpkg
USER root
COPY src /opt/program-service/
WORKDIR /opt/program-service/
RUN npm install
CMD ["node", "app.js", "&"]
