const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();

app.use(express.json());
let db = null;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initialization = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server is running... :)");
    });
  } catch (error) {
    console.log(`db error: ${error.message}`);
  }
};
initialization();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const userDetailsQuery = `
  SELECT * FROM user WHERE username = '${username}';`;
  const userDetails = await db.get(userDetailsQuery);

  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkPassword = await bcrypt.compare(password, userDetails.password);

    if (checkPassword === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtoken = await jwt.sign(payload, "MY_SECRET");
      response.send({ jwtToken: jwtoken });
    }
  }
});

const authentication = async (request, response, next) => {
  const auth = request.headers["authorization"];
  let jwtoken;
  if (auth !== undefined) {
    jwtoken = auth.split(" ")[1];
  }
  if (jwtoken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtoken, "MY_SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/states/", authentication, async (request, response) => {
  const query = `
  SELECT 
    state_id AS stateId,
    state_name AS stateName,
    population
  FROM state;`;

  const result = await db.all(query);
  response.send(result);
});

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const query = `
  SELECT 
    state_id AS stateId,
    state_name AS stateName,
    population
  FROM state
  WHERE state_id = ${stateId};`;

  const result = await db.get(query);
  response.send(result);
});

app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const query = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );`;

  await db.run(query);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;

    const query = `
    SELECT 
        district_id AS districtId,
        district_name AS districtName,
        state_id AS stateId,
        cases,
        cured,
        active,
        deaths
    FROM district 
    WHERE district_id =${districtId};`;

    const result = await db.get(query);
    response.send(result);
  }
);

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;

    const query = `
    DELETE FROM district
    WHERE district_id =${districtId};`;

    await db.run(query);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const query = `
    UPDATE district
    SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE district_id =${districtId};`;

    await db.run(query);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM district 
    WHERE state_id =${stateId};`;

    const result = await db.get(query);
    response.send(result);
  }
);

module.exports = app;
