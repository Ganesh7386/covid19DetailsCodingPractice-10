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

app.get("/states/", authorizeWithJWTToken, async (req, res) => {
  const gettingAllStatesQuery = `select * from state`;
  const allStatesList = await db.all(gettingAllStatesQuery);
  res.send(allStatesList);
});

app.get("/states/:id/", authorizeWithJWTToken, async (req, res) => {
  const { id } = req.params;
  const gettingSpecifiedStateWithIdQuery = `select * from state where state_id = ${id}`;
  const requestedStateDetails = await db.get(gettingSpecifiedStateWithIdQuery);
  res.send(requestedStateDetails);
});

app.post("/districts/", authorizeWithJWTToken, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const addingDistrictQuery = `INSERT INTO district(district_name , state_id , cases , cured , active , deaths)
    VALUES ('${districtName}' , ${stateId} , ${cases} , ${cured} , ${active} , ${deaths})`;
  const addingStatePromiseObj = await db.run(addingDistrictQuery);
  console.log(addingStatePromiseObj);
  const lastId = addingStatePromiseObj.lastId;
  res.send(lastId);
});

app.get("/districts/:id/", authorizeWithJWTToken, async (req, res) => {
  const { id } = req.params;
  const gettingSpecifiedDistrictIdQuery = `SELECT * FROM district WHERE district_id = ${id}`;
  const districtDetails = await db.get(gettingSpecifiedDistrictIdQuery);
  res.send(districtDetails);
});

app.put("/districts/:id/", async (req, res) => {
  const { id } = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const updatingDistrictQuery = `UPDATE DISTRICT 
    SET district_name = '${districtName}' , state_id = ${stateId} ,cases = ${cases} , cured = ${cured} , active = ${active} , deaths = ${deaths}
    WHERE district_id = ${id} `;
  const updatingDistrictPromise = await db.run(updatingDistrictQuery);
  console.log(updatingDistrictPromise);
  res.send("Updated successfully");
});

app.delete("/districts/:id/", async (req, res) => {
  const { id } = req.params;
  const deletingDistrictQuery = `DELETE FROM DISTRICT WHERE district_id = ${id}`;
  const deletingDistrictPromise = await db.run(deletingDistrictQuery);
  console.log(deletingDistrictPromise);
  res.send("deleted successfully");
});

app.get("/states/:stateId/stats/", async (req, res) => {
  try {
    const { stateId } = req.params;
    const gettingAllStatsQuery = `SELECT sum(cases) as totalCases , 
    sum(cured) as totalCured , 
    sum(active) as totalActive , 
    sum(deaths) as totalDeaths
    FROM DISTRICT WHERE state_id = ${stateId}`;
    const statsOfState = await db.get(gettingAllStatsQuery);
    console.log(statsOfState);
    res.send(statsOfState);
  } catch (e) {
    console.log(e.message);
  }
});
