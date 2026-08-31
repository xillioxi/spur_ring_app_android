ARG NODE_IMAGE=aed-acr-registry-vpc.cn-hangzhou.cr.aliyuncs.com/base/node:20.16-alinux3
ARG NGINX_IMAGE=aed-acr-registry-vpc.cn-hangzhou.cr.aliyuncs.com/base/nginx-unprivileged:1.27-alpine
ARG NPM_REGISTRY=https://registry.npmmirror.com

FROM ${NODE_IMAGE} AS builder

ARG NPM_REGISTRY

WORKDIR /app

RUN npm config set registry ${NPM_REGISTRY}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM ${NGINX_IMAGE}

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=101:101 /app/dist/ /usr/share/nginx/html/

EXPOSE 8080
