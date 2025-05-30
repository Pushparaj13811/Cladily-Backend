// 1xx: Informational
const HTTP_CONTINUE = 100;
const HTTP_SWITCHING_PROTOCOLS = 101;

// 2xx: Success
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_ACCEPTED = 202;
const HTTP_NO_CONTENT = 204;

// 3xx: Redirection
const HTTP_MOVED_PERMANENTLY = 301;
const HTTP_FOUND = 302;
const HTTP_NOT_MODIFIED = 304;

// 4xx: Client Errors
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_TOO_MANY_REQUESTS = 429;

// 5xx: Server Errors
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_NOT_IMPLEMENTED = 501;
const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;
const HTTP_GATEWAY_TIMEOUT = 504;

export {
  HTTP_CONTINUE,
  HTTP_SWITCHING_PROTOCOLS,
  HTTP_OK,
  HTTP_CREATED,
  HTTP_ACCEPTED,
  HTTP_NO_CONTENT,
  HTTP_MOVED_PERMANENTLY,
  HTTP_FOUND,
  HTTP_NOT_MODIFIED,
  HTTP_BAD_REQUEST,
  HTTP_UNAUTHORIZED,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  HTTP_METHOD_NOT_ALLOWED,
  HTTP_CONFLICT,
  HTTP_UNPROCESSABLE_ENTITY,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_IMPLEMENTED,
  HTTP_BAD_GATEWAY,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_GATEWAY_TIMEOUT,
};
