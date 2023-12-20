const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const db_path = path.join(__dirname, "./covid19IndiaPortal.db");

app.use(express.json());
let db = null;

const connectToDatabaseAndInitializeServer = async () => {
  try {
    db = await open({
      filename: db_path,
      driver: sqlite3.Database,
    });

    app.listen(5000, () => {
      console.log(`server is listening at ${5000} port`);
    });
  } catch (e) {
    console.log(e);
  }
};

connectToDatabaseAndInitializeServer();

const sendJWTToken = (req, res, next) => {
  const { username } = req.body;
  const payload = {
    username,
  };
  const generatedToken = jwt.sign(payload, "My_Secret_Key");
  const tokenObj = {
    jwt_token: generatedToken,
  };
  req.tokenBody = tokenObj;
  next();
};

const authenticateUser = async (req, res, next) => {
  const { username, password } = req.body;
  const gettingUserBasedOnUsernameQuery = `SELECT * FROM user where username = '${username}' `;
  const storedWantedUser = await db.get(gettingUserBasedOnUsernameQuery);
  console.log("got storedWantedUser");

  if (storedWantedUser === undefined) {
    console.log("No user found");
    res.status(400).send("Invalid user");
  } else {
    console.log("user found");
    console.log("checking password");
    const storedPassword = storedWantedUser.password;
    const isPasswordMatched = await bcrypt.compare(password, storedPassword);

    if (isPasswordMatched === false) {
      console.log("password unmatched");
      res.status(400).send("Password Incorrect");
    } else {
      // define a SendJWTToken method
      console.log("password matched , went to next middleware function");
      next();
    }
  }
};

const authorizeWithJWTToken = (req, res, next) => {
  try {
    const bearerLine = req.headers["authorization"];
    console.log(bearerLine);
    if (bearerLine === undefined) {
      res.status(401).send("Unauthorized");
    } else {
      const jwtTokenInBearerLine = bearerLine.split(" ")[1];
      jwt.verify(jwtTokenInBearerLine, "My_Secret_Key", (error, payload) => {
        if (error) {
          res.status(401).send("token found , but did'nt match with user");
        } else {
          const { username } = payload;
          req.gotUsernameFromPayload = username;
          next();
        }
      });
    }
  } catch (e) {
    console.log(e.message);
  }
};

app.post("/login/", authenticateUser, sendJWTToken, (req, res) => {
  const tokenObj = req.tokenBody; // De-Structured req = {tokenBody : tokenObj}
  res.status(200).send(tokenObj);
});

app.get("/states/", authorizeWithJWTToken, (req, res) => {
  const gotUsernameFromPayload = req.gotUsernameFromPayload;
  res.send({ username: gotUsernameFromPayload, response: "ok" });
});
