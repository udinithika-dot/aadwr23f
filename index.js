const express = require('express');
const app = express();
const pairRouter = require('./pair');

// Railway එක සඳහා Port එක ලබාගැනීම
const PORT = process.env.PORT || 8080;

// pair.js ෆයිල් එක Express Router එකට සම්බන්ධ කිරීම
app.use('/', pairRouter);

app.listen(PORT, () => {
    console.log(`✅ Server is running perfectly on port ${PORT}`);
});
