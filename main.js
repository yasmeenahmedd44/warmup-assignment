const fs = require("fs");


function getShiftDuration(startTime, endTime) {
    function toSeconds(t) {
        let parts = t.split(" ");
        let time = parts[0];
        let period = parts[1];
        let nums = time.split(":");
        let h = parseInt(nums[0]);
        let m = parseInt(nums[1]);
        let s = parseInt(nums[2]);

        if (period === "pm" && h !== 12) h += 12;
        if (period === "am" && h === 12) h = 0;

        return h*3600 + m*60 + s;
    }

    function toHMS(sec) {
        let h = Math.floor(sec/3600);
        sec = sec % 3600;
        let m = Math.floor(sec/60);
        let s = sec % 60;

        if (m < 10) m = "0" + m;
        if (s < 10) s = "0" + s;

        return h + ":" + m + ":" + s;
    }

    let diff = toSeconds(endTime) - toSeconds(startTime);
    if (diff < 0) diff += 24*3600;

    return toHMS(diff);
}

function getIdleTime(startTime, endTime) {
    function toSeconds(t) {
        let parts = t.split(" ");
        let time = parts[0];
        let period = parts[1];
        let nums = time.split(":");
        let h = parseInt(nums[0]);
        let m = parseInt(nums[1]);
        let s = parseInt(nums[2]);

        if (period === "pm" && h !== 12) h += 12;
        if (period === "am" && h === 12) h = 0;

        return h*3600 + m*60 + s;
    }

    function toHMS(sec) {
        let h = Math.floor(sec/3600);
        sec = sec % 3600;
        let m = Math.floor(sec/60);
        let s = sec % 60;

        if (m < 10) m = "0" + m;
        if (s < 10) s = "0" + s;

        return h + ":" + m + ":" + s;
    }

    let start = toSeconds(startTime);
    let end = toSeconds(endTime);

    if (end < start) end += 24*3600;

    let workStart = 8*3600;
    let workEnd = 22*3600;

    let idle = 0;

    if (start < workStart) idle += Math.min(end, workStart) - start;
    if (end > workEnd) idle += end - Math.max(start, workEnd);

    return toHMS(idle);
}

function getActiveTime(shiftDuration, idleTime) {
    function toSeconds(t) {
        let parts = t.split(":");
        let h = parseInt(parts[0]);
        let m = parseInt(parts[1]);
        let s = parseInt(parts[2]);
        return h*3600 + m*60 + s;
    }

    function toHMS(sec) {
        let h = Math.floor(sec/3600);
        sec = sec % 3600;
        let m = Math.floor(sec/60);
        let s = sec % 60;

        if (m < 10) m = "0" + m;
        if (s < 10) s = "0" + s;

        return h + ":" + m + ":" + s;
    }

    let active = toSeconds(shiftDuration) - toSeconds(idleTime);
    return toHMS(active);
}


function metQuota(date, activeTime) {
    function toSeconds(t) {
        let parts = t.split(":");
        let h = parseInt(parts[0]);
        let m = parseInt(parts[1]);
        let s = parseInt(parts[2]);
        return h*3600 + m*60 + s;
    }

    let active = toSeconds(activeTime);

    let d = new Date(date);
    let eidStart = new Date("2025-04-10");
    let eidEnd = new Date("2025-04-30");

    let quota;

    if (d >= eidStart && d <= eidEnd) {
        quota = 6 * 3600;
    } else {
        quota = 8 * 3600 + 24 * 60;
    }

    return active >= quota;
}

function addShiftRecord(textFile, shiftObj) {
    let data = fs.readFileSync(textFile, "utf8").trim().split("\n");

    for (let line of data) {
        let cols = line.split(",");
        if (cols[0] === shiftObj.driverID && cols[2] === shiftObj.date) {
            return {};
        }
    }

    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let met = metQuota(shiftObj.date, activeTime);
    let hasBonus = false;

    let newLine = [
        shiftObj.driverID,
        shiftObj.driverName,
        shiftObj.date,
        shiftObj.startTime,
        shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        met,
        hasBonus
    ].join(",");

    fs.appendFileSync(textFile, "\n" + newLine);

    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: met,
        hasBonus: hasBonus
    };
}


function setBonus(textFile, driverID, date, newValue) {
    let data = fs.readFileSync(textFile, "utf8").trim().split("\n");
    let updated = [];

    for (let line of data) {
        let cols = line.split(",");
        if (cols[0] === driverID && cols[2] === date) {
            cols[9] = newValue.toString();
            line = cols.join(",");
        }
        updated.push(line);
    }

    fs.writeFileSync(textFile, updated.join("\n"));
}


function countBonusPerMonth(textFile, driverID, month) {
    let data = fs.readFileSync(textFile, "utf8").trim().split("\n");
    let count = 0;
    let found = false;

    month = month.toString().padStart(2, '0');

    for (let line of data) {
        let cols = line.split(",");
        let id = cols[0];
        let date = cols[2];
        let hasBonus = cols[9].trim().toLowerCase();

        if (id === driverID) {
            found = true;
            let m = date.split("-")[1];
            if (m === month && hasBonus === "true") {
                count++;
            }
        }
    }

    if (!found) return -1;
    return count;
}

function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let data = fs.readFileSync(textFile, "utf8").trim().split("\n");
    let totalSeconds = 0;

    function toSeconds(t) {
        let parts = t.split(":");
        return parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseInt(parts[2]);
    }

    function toHMS(sec) {
        let h = Math.floor(sec/3600);
        sec %= 3600;
        let m = Math.floor(sec/60);
        let s = sec % 60;
        if (m < 10) m = "0" + m;
        if (s < 10) s = "0" + s;
        return h + ":" + m + ":" + s;
    }

    let mStr = month.toString().padStart(2, '0');

    for (let line of data) {
        let cols = line.split(",");
        if (cols[0] === driverID) {
            let date = cols[2];
            let m = date.split("-")[1];
            if (m === mStr) {
                totalSeconds += toSeconds(cols[7]);
            }
        }
    }

    return toHMS(totalSeconds);
}
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {

    let shifts = fs.readFileSync(textFile, 'utf8').trim().split('\n');

    let totalReqS = 0;
    let targetMonth = month.toString().padStart(2,'0');

    for (let s of shifts) {

        let cols = s.split(',');

        if (cols[0] === driverID) {

            let date = cols[2];
            let m = date.split('-')[1];

            if (m === targetMonth) {

                let dObj = new Date(date);

                let isEid = dObj >= new Date("2025-04-10") && dObj <= new Date("2025-04-30");

                if (isEid) totalReqS += 6 * 3600;
                else totalReqS += 8 * 3600 + 24 * 60;
            }
        }
    }

    let finalSeconds = totalReqS - (bonusCount * 2 * 3600);
    if (finalSeconds < 0) finalSeconds = 0;

    function toHMS(sec) {
        let h = Math.floor(sec / 3600);
        sec %= 3600;
        let m = Math.floor(sec / 60);
        let s = sec % 60;

        return h + ":" + m.toString().padStart(2,'0') + ":" + s.toString().padStart(2,'0');
    }

    return toHMS(finalSeconds);
}

function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    let data = fs.readFileSync(rateFile, "utf8").trim().split("\n");
    let basePay = 0;
    let tier = 0;

    for (let line of data) {
        let cols = line.split(",");
        if (cols[0] === driverID) {
            basePay = parseInt(cols[2]);
            tier = parseInt(cols[3]);
        }
    }

    function toSeconds(t) {
        let parts = t.split(":");
        return parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseInt(parts[2]);
    }

    let actual = toSeconds(actualHours);
    let required = toSeconds(requiredHours);
    let missing = Math.max(0, required - actual);

    let allowance = 0;
    if (tier === 1) allowance = 50*3600;
    else if (tier === 2) allowance = 20*3600;
    else if (tier === 3) allowance = 10*3600;
    else if (tier === 4) allowance = 3*3600;

    if (missing <= allowance) return basePay;

    let excess = missing - allowance;
    let missingHours = Math.floor(excess / 3600);

    let deductionRatePerHour = Math.floor(basePay / 185);
    let deduction = missingHours * deductionRatePerHour;

    return basePay - deduction;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};