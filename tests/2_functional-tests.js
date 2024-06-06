const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

let thread_id;
let reply_id;

suite('Functional Tests', function() {
    test('Creating a new thread: POST request to /api/threads/{board}', done => {
        chai.request(server)
         .post('/api/threads/testBoard')
         .send({
            board: 'testBoard',
            text: 'hello its me the tester',
            delete_password: '123'
         })
         .end((err, res) => {
            thread_id = res.body._id;
            assert.equal(res.status, 200);
            assert.equal(res.body.text, 'hello its me the tester');
            assert.equal(res.body.reported, false);

            done();
         })
    })

    test('Viewing the 10 most recent threads with 3 replies each: GET request to', done => {
        chai.request(server)
         .get('/api/threads/testBoard')
         .end((err, res) => {
            assert.equal(res.status, 200);
            assert.isArray(res.body);
            done();
         })
    })

    test('Deleting a thread with the incorrect password: DELETE request to /api/threads/{board} with an invalid delete_password', done => {
        chai.request(server)
         .delete('/api/threads/testBoard')
         .send({
            board: 'testBoard',
            thread_id: thread_id,
            delete_password: '12'
         })
         .end((err, res) => {
            assert.equal(res.text, 'incorrect password');

            done();
         })
    })

    test('Reporting a thread: PUT request to /api/threads/{board}', done => {
        chai.request(server)
         .put('/api/threads/testBoard')
         .send({
            board: 'testBoard',
            thread_id: thread_id,
         })
         .end((err, res) => {
            assert.equal(res.text, 'reported');
            done();
         })
    })

    test('Creating a new thread: POST request to /api/threads/{board}', done => {
        chai.request(server)
         .post('/api/replies/testBoard')
         .send({
            board: 'testBoard',
            thread_id: thread_id,
            text: 'hello i replied',
            delete_password: '1234'
         })
         .end((err, res) => {
            reply_id = res.body._id;
            assert.equal(res.status, 200);
            assert.equal(res.body.text, 'hello i replied');
            assert.equal(res.body.reported, false);

            done();
         })
    })

    test('Viewing a single thread with all replies: GET request to /api/replies/{board}', done => {
        chai.request(server)
         .get(`/api/replies/testBoard?thread_id=${thread_id}`)
         .end((err, res) => {
            assert.equal(res.status, 200);
            assert.equal(res.body._id, thread_id);
            assert.equal(res.body.text, 'hello its me the tester');
            assert.isArray(res.body.replies);
            done();
         })
    })

    test('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board} with an invalid delete_password', done => {
        chai.request(server)
         .delete('/api/replies/testBoard')
         .send({
            board: 'testBoard',
            thread_id: thread_id,
            reply_id: reply_id,
            delete_password: '123'
         })
         .end((err, res) => {
            assert.equal(res.text, 'incorrect password');

            done();
         })
    })

    test('Reporting a thread: PUT request to /api/threads/{board}', done => {
        chai.request(server)
         .put('/api/threads/testBoard')
         .send({
            board: 'testBoard',
            thread_id: thread_id,
            reply_id: reply_id
         })
         .end((err, res) => {
            assert.equal(res.text, 'reported');
            done();
         })
    })

    test('Deleting a reply with the correct password: DELETE request to /api/replies/{board} with a valid delete_password', done => {
        chai.request(server)
         .delete('/api/replies/testBoard')
         .send({
            board: 'testBoard',
            thread_id: thread_id,
            reply_id: reply_id,
            delete_password: '1234'
         })
         .end((err, res) => {
            assert.equal(res.text, 'success');
            done();
         })
    })


    test('Deleting a thread with the correct password: DELETE request to /api/threads/{board} with a valid delete_password', done => {
        chai.request(server)
         .delete('/api/threads/testBoard')
         .send({
            board: 'testBoard',
            thread_id: thread_id,
            delete_password: '123'
         })
         .end((err, res) => {
            assert.equal(res.text, 'success');

            done();
         })
    })
});
