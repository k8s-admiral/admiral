FROM node:10-jessie as build

WORKDIR /opt/build

#going from least to most likely to change
COPY ./custom_types ./custom_types

COPY ./*.json ./
RUN npm install

# Config is less likely to change than code if it can be overriden outside of the package
COPY ./config ./config
# Code is more likely to change than dependencies
COPY ./app ./app

ENV NODE_ENV=production

RUN ./node_modules/.bin/tsc \
  && cp package.json ./dist \
  && cp package-lock.json ./dist \
  && cd dist \
  && npm install

FROM node:10-alpine

WORKDIR /opt/promt/

COPY --from=build /opt/build/dist ./

ENTRYPOINT [ "node",  "./app/index.js" ]
