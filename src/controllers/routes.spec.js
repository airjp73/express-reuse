var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
var chaiHttp = require('chai-http')
chai.use(chaiAsPromised)
chai.use(chaiHttp)

var should = chai.should()
var expect = chai.expect
var sinon = require('sinon')
var mongoose = require('mongoose')

var config = require('../config')
var con = require("../constants")
var User   = require('../../exampleServer/models/user.js')
var encrypt = require('../helpers/encryption.js')
//var Email  = require('../../exampleServer/emails')
var app = require('../../exampleServer/server.js')
var server = {}

const TEST_USER = {
  email: "mrTestUser@test.com",
  profileName: "Mr. Test",
  password: "myTestPass",
  newPassword: "myNewTestPass",
  confirmEmailToken: "testtest"
}

var mockUser = async () => {
  var testUser = new User()
  testUser.email = TEST_USER.email
  testUser.password = encrypt.hashPassword(TEST_USER.password)
  testUser.confirmEmailToken = TEST_USER.confirmEmailToken
  testUser.emailConfirmed = false
  return await testUser.save()
}

const COOKIE = "connect.sid"

//Routes
  //login
  //logout
  //signup
  //resendConfirmation
  //confirmEmail
  //changePassword
  //forgotPassword
  //resetPassword

if (process.env.NODE_ENV == 'test') {

  describe('route testing', () => {
    before(() => {

    })
    beforeEach(async () => {
      await User.collection.remove({email: TEST_USER.email})
      server = chai.request.agent(app)

    })

    ////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////Login
    ////////////////////////////////////////////////////////////////////////////
    describe('login', () => {
      it("should return 200 and session cookie if successfull login", async () => {
        var user = await mockUser()
        var fields = {
          email: TEST_USER.email,
          password: TEST_USER.password
        }

        var res = await server.post("/auth/login").send(fields)
        expect(res).to.have.status(200)
        expect(res).to.have.cookie(COOKIE)
      })

      it("should return 401 if failed login", async () => {
        var fields = {
          email: "nomatch@nomatch.com",
          password: "nomatchpass"
        }

        var res = await server.post("/auth/login").send(fields)
        expect(res).to.have.status(401)
      })
    })

    ////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////Logout
    ////////////////////////////////////////////////////////////////////////////
    describe('logout', () => {
      it("should return 401 if not logged in", async () => {
        var res = await server.post("/auth/logout")
        expect(res).to.have.status(401)
      })

      it("should return 200 and no cookie on successfull logout", async () => {
        var user = await mockUser()
        var fields = {
          email: TEST_USER.email,
          password: TEST_USER.password
        }

        var res = await server.post("/auth/login").send(fields)
        res = await server.post("/auth/logout")
        expect(res).to.have.status(200)
        expect(res).to.not.have.cookie(COOKIE)
      })
    })

    ////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////Signup
    ////////////////////////////////////////////////////////////////////////////
    describe('signup', () => {
      it("should return 200 and save user to database", async () => {
        var res = await server.post("/auth/signup").send({
          email: TEST_USER.email,
          password: TEST_USER.password
        })

        var user = await User.findOne({email: TEST_USER.email})

        expect(user).to.exist
        expect(res).to.have.status(200)
      })

      it("should return 401 if user already exists", async () => {
        var user = await mockUser()
        var fields = {
          email: TEST_USER.email,
          password: TEST_USER.password
        }

        var res = await server.post("/auth/signup").send(fields)
        expect(res).to.have.status(401)
      })

      it("should return 400 if email or password not provided", async () => {
        var fields = {
          email: TEST_USER.email
        }

        var res = await server.post("/auth/signup").send(fields)
        expect(res).to.have.status(400)
      })
    })

    ////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////ResendConfirmation
    ////////////////////////////////////////////////////////////////////////////
    describe("resendConfirmation", () => {
      it("should send an email with confirmation token", async () => {
        await mockUser()
        var fields = {
          email: TEST_USER.email,
          password: TEST_USER.password
        }
        var mail = sinon.stub(config.mailer, "sendEmail")
        var url = "http://127.0.0.1:" + process.env.PORT +"/" + con.routes.CONFIRM_EMAIL + "/" + TEST_USER.confirmEmailToken

        await server.post("/auth/login").send(fields)
        await server.post("/auth/resendConfirmation")

        sinon.assert.calledOnce(mail)
        expect(mail.args[0][2].link).to.equal(url)

        mail.restore()
      })

      it("should return 403 if already confirmed", async () => {
        var user = await mockUser()
        user.emailConfirmed = true
        await user.save()

        var fields = {
          email: TEST_USER.email,
          password: TEST_USER.password
        }
        await server.post("/auth/login").send(fields)

        var res = await server.post("/auth/resendConfirmation")
        expect(res).to.have.status(403)
      })

      it("should return 401 if not logged in", async () => {
        var res = await server.post("/auth/resendConfirmation")
        expect(res).to.have.status(401)
      })
    })


    ////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////ConfirmEmail
    ////////////////////////////////////////////////////////////////////////////
    describe("confirmEmail", () => {
      it("should set emailConfirmed to true and delete token", async () => {
        await mockUser()
        var fields = {
          confirmEmailToken: TEST_USER.confirmEmailToken
        }

        await server.post("/auth/confirmEmail").send(fields)

        var user = await User.findOne({email: TEST_USER.email}, "emailConfirmed confirmEmailToken")
        expect(user.emailConfirmed).to.be.true
        expect(user.confirmEmailToken).to.be.undefined
      })

      it("should return 404 if confirmEmailToken has no match", async () => {
        var fields = {
          confirmEmailToken: "asdfasdf"
        }

        var res = await server.post("/auth/confirmEmail").send(fields)
        expect(res).to.have.status(404)
      })
    })

    ////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////ChangePassword
    ////////////////////////////////////////////////////////////////////////////
    describe("changePassword", () => {
      it("should change users password", async () => {
        await mockUser()
        var fields = {
          email: TEST_USER.email,
          password: TEST_USER.password,
          newPassword: TEST_USER.newPassword
        }

        await server.post("/auth/changePassword").send(fields)

        var user = await config.database.getUser({email:TEST_USER.email}, [con.fields.EMAIL, con.fields.PASSWORD])
        var passChanged = encrypt.matchPassword(TEST_USER.newPassword, user.password)
        expect(passChanged).to.be.true
      })

      it("should return 401 on invalid user info", async () => {
        var fields = {
          email: TEST_USER.email,
          password: "noMatch",
          newPassword: TEST_USER.newPassword
        }

        var res = await server.post("/auth/changePassword").send(fields)
        expect(res).to.have.status(401)
      })

      it("should return 400 on incomplete info", async () => {
        var fields = {
          email: TEST_USER.email,
          newPassword: TEST_USER.newPassword
        }

        var res = await server.post("/auth/changePassword").send(fields)
        expect(res).to.have.status(400)
      })
    })

    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////forgotPassword
    ////////////////////////////////////////////////////////////////////////////
    describe("forgotPassword", () => {
      it("should set resetPasswordToken and resetPasswordTokenExpires and send email with link", async () => {
        await mockUser()
        var mail = sinon.stub(config.mailer, "sendEmail")
        var fields = {
          email: TEST_USER.email
        }

        var res = await server.post("/auth/forgotPassword").send(fields)
        expect(res).to.have.status(200)

        var user = await config.database.getUser({email:TEST_USER.email}, [con.fields.RESET_PASSWORD_TOKEN, con.fields.RESET_PASSWORD_EXPIRES])
        expect(user.resetPasswordToken).to.exist
        expect(user.resetPasswordExpires).to.exist

        var url = "http://127.0.0.1:" + process.env.PORT +"/" + con.routes.RESET_PASSWORD + "/" + user.resetPasswordToken
        sinon.assert.calledOnce(mail)
        expect(mail.args[0][2].link).to.equal(url)
        mail.restore()
      })

      it("should return 404 if no user with that email", async () => {
        var fields = {
          email: "nomatch@nomatch.com"
        }

        var res = await server.post("/auth/forgotPassword").send(fields)
        expect(res).to.have.status(404)
      })
    })

    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////resetPassword
    ////////////////////////////////////////////////////////////////////////////
    describe("resetPassword", () => {
      it("should change password to newPassword field and send an email", async () => {
        var mail = sinon.stub(config.mailer, "sendEmail")
        var token = "testToken"

        var user = await mockUser()
        user.resetPasswordToken = token
        user.resetPasswordExpires = Date.now() + 360000
        await user.save()

        var fields = {
          resetPasswordToken: token,
          newPassword: TEST_USER.newPassword
        }
        var res = await server.post("/auth/resetPassword").send(fields)
        expect(res).to.have.status(200)

        user = await config.database.getUser({_id: user.id}, [con.fields.PASSWORD])
        expect(encrypt.matchPassword(TEST_USER.newPassword, user.password)).to.be.true
        sinon.assert.calledOnce(mail)
        mail.restore()
      })

      it("should return 403 if token expired", async () => {
        var mail = sinon.stub(config.mailer, "sendEmail")
        var token = "testToken"

        var user = await mockUser()
        user.resetPasswordToken = token
        user.resetPasswordExpires = Date.now() - 1
        await user.save()

        var fields = {
          resetPasswordToken: token,
          newPassword: TEST_USER.newPassword
        }
        var res = await server.post("/auth/resetPassword").send(fields)
        expect(res).to.have.status(403)

        user = await config.database.getUser({_id: user.id}, [con.fields.PASSWORD])
        expect(encrypt.matchPassword(TEST_USER.password, user.password)).to.be.true
        sinon.assert.notCalled(mail)
        mail.restore()

      })

      it("should return 404 if no matching user", async () => {
        var mail = sinon.stub(config.mailer, "sendEmail")
        var fields = {
          resetPasswordToken: "nomatch",
          newPassword: TEST_USER.newPassword
        }

        var res = await server.post("/auth/resetPassword").send(fields)
        expect(res).to.have.status(404)
        sinon.assert.notCalled(mail)
        mail.restore()
      })
    })

  })//end describe
}
