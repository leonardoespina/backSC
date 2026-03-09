const { CupoActual } = require('./models');
const moment = require('moment');

async function checkExistentQuotas() {
    try {
        const currentPeriod = moment().format('YYYY-MM'); // Should be 2026-02
        console.log(`Checking quotas for period: ${currentPeriod}`);

        const count = await CupoActual.count({
            where: { periodo: currentPeriod }
        });

        console.log(`Found ${count} records for ${currentPeriod}`);

        if (count === 0) {
            console.log("CRITICAL: No quotas found for the current month!");
        } else {
            console.log("OK: Quotas exist.");
        }
    } catch (error) {
        console.error("Error checking quotas:", error);
    }
}

checkExistentQuotas();
