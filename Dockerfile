FROM node:12.20.1-slim
MAINTAINER "Ekstep" "info@ekstep.in"
USER root
COPY src /opt/program-service/
WORKDIR /opt/program-service/
RUN npm install
CMD ["node", "app.js", "&"]
