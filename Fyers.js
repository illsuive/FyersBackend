const express = require('express');
const fyers = require("fyers-api-v3");
const dotenv = require('dotenv');
const { timeStamp } = require('node:console');
const XLSX = require('xlsx')
dotenv.config();
const { google } = require('googleapis');

const router = express.Router();

const PORT = process.env.PORT || 4000;

let global_access_token = null;
let io = null;
let previousState = {};

const setIO = (socketIO) => {
    io = socketIO;
};

// 1. Initialize the Fyers Model
const fyersModel = new fyers.fyersModel();
fyersModel.setAppId(process.env.APP_ID);
fyersModel.setRedirectUrl(`https://fyersbackend.onrender.com/api/fyers/callback`);

// 2. ROUTE: Generate the Login URL

router.get("/login", (req, res) => {
    const authCodeURL = fyersModel.generateAuthCode();
    res.json({ url: authCodeURL });
});

// 3. ROUTE: The Callback (The "Redirect URL" you set in Fyers)
router.get("/callback", async (req, res) => {
    const { auth_code } = req.query;

    if (!auth_code) {
        return res.status(400).send("No auth code received");
    }

    try {
        const response = await fyersModel.generate_access_token({
            client_id: process.env.APP_ID,
            secret_key: process.env.SECRET_ID, 
            auth_code: auth_code
        });

        if (response.s === "ok") {
            // This token is valid for 24 hours
            const accessToken = response.access_token;
            
            // TIP: In a real MERN app, save this to MongoDB or a local file
            // console.log("Access Token Generated:", accessToken);
            global_access_token = accessToken;
            // fyersModel.setAccessToken(global_access_token);
            
            res.send("<h1>Login Successful!</h1><p>You can now fetch the Option Chain.</p>");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Error generating access token");
    }
});

router.get("/option-chain", async (req, res) => {
    if (!global_access_token) {
        return res.status(401).send("Please login first at /api/fyers/login");
    }

    try {
        fyersModel.setAccessToken(global_access_token);

       const response = await fyersModel.getOptionChain({
        "symbol": "NSE:NIFTY50-INDEX",
        "strikecount": 15
        });
  
        // create excel
        if (response.s === "ok") {
            const optionsData = response.data.optionsChain;
            let CE = optionsData.filter((item)=> item.option_type === 'CE') ;
            let PE = optionsData.filter((item)=> item.option_type === 'PE') ;
            res.json({
                message : 'data fetched successfully',
                data : { CE, PE }
            })
        } else {
            res.status(400).json({ message: "Failed to fetch data", detail: response });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

// Automatic Polling for Socket.io
const pollData = async () => {
    if (!global_access_token || !io) {
        setTimeout(pollData, 1000);
        return;
    }

    try {
        fyersModel.setAccessToken(global_access_token);
        const response = await fyersModel.getOptionChain({
            "symbol": "NSE:NIFTY50-INDEX",
            "strikecount": 10
        });

        if (response.s === "ok") {
            const optionsData = response.data.optionsChain;
            const dirtyData = [];
            
            optionsData.forEach((item) => {
                if (previousState[item.symbol] !== item.ltp) {
                    dirtyData.push(item);
                    previousState[item.symbol] = item.ltp;
                }
            });

            if (dirtyData.length > 0) {
                let CE = dirtyData.filter((item) => item.option_type === 'CE');
                let PE = dirtyData.filter((item) => item.option_type === 'PE');
                io.emit('dataUpdate', { message: 'automatic update', data: { CE, PE } });
            }
        }
    } catch (error) {
        console.error("Polling Error:", error.message);
    } finally {
        setTimeout(pollData, 1000);
    }
};

pollData();

module.exports = { router, setIO };
