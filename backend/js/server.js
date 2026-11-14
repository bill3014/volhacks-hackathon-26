require("dotenv").config()

// gives server access to express, like importing a library
const express = require('express');

const path = require("path");

// create server
const server = express();


server.use(express.static(path.join(__dirname, "../frontend")));

const cors = require("cors");

server.use(cors());


// creating a routes
// when a GET request is sent to /, send the landing.html file
// in this case being the home/landing page
server.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../landing.html"));
});

server.get("/weather", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/html/weather.html"));
})

server.get("/about", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/html/about.html"));
})

// listens to requests on port 3000
server.listen(3000, () => {
    console.log("Server started on port 3000");
})