ARG NODE_VERSION=18.17.1
ARG NPM_VERSION=9.8.1

FROM node:${NODE_VERSION}-alpine as base
RUN npm i -g npm@${NPM_VERSION}
RUN apk add --no-cache --update \
    tzdata \
    bluez \
    bluez-deprecated

FROM base as development

ENV NODE_ENV=development

RUN apk add --no-cache --update \
    python3 \
    make \
    g++

RUN mkdir -p /home/node/app
WORKDIR /home/node/app

COPY package*.json ./
COPY tsconfig.json .eslintrc .prettierrc ./
RUN npm ci

COPY --chown=node:node  . ./

FROM base as production

ENV NODE_ENV=production
RUN rm -rf /opt/yarn*

RUN mkdir -p /home/node/app && chown node:node /home/node/app
WORKDIR /home/node/app

COPY --from=development --chown=node:node /home/node/app/ ./

RUN npm run build
RUN npm prune

CMD [ "node", "dist/index.js" ]
