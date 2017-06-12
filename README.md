# ponyexpress

__Barebones HTTP POST to Socket.io gateway__

Exposes a Socket.io server relaying incoming HTTP `POST` requests as socket events; also allows for setting the response if the socket client(s) respond back within a reasonable time. Requires both requests and socket clients to authorize using SHA-256 tokens.

## Config

- ### _port_
The port to use

- ### _hashedSocketToken_
SHA-256 hash of the token to use for socket auth 

- ### _postTokenPath_
Auth token path in the request payload

- ### _hashedPostToken_
SHA-256 hash of the token to use for request auth

- ### _resDefaultPayload_
Default payload to respond with if a socket client doesn't respond in time

- ### _resTimeout_
Time limit in ms to wait for socket clients to respond back before responding with `resDefaultPayload`

## Socket API

### `auth` event (client -> server)
Upon connecting, socket clients must send an `auth` event with the socket auth token as the payload to receive `POST` events. If the token is invalid, they will be disconnected by the server.

### `POST` event (server -> client)
When a valid `POST` request is made, the server will emit a `POST` socket event with a subset of the [HapiJS request object](https://hapijs.com/api#request-object) as the payload. The subset of properties is as follows:

- `headers`
- `id`
- `info`
- `method`
- `mime`
- `payload`

### `res` event (client -> server)
Socket clients can respond to a `POST` event by replying with a `res` event, containing a JSON payload with `id` and `payload` properties (containing the HapiJS request id, and a response payload, respectively). Only the first response will be honored; the [`ack` parameter of the client's event emission](https://socket.io/docs/client-api/#socket-emit-eventname-args-ack) will be invoked if the server has already responded.