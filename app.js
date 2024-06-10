// 引入必要模块
const express = require('express');
const multer = require('multer'); // 引入处理文件上传的中间件 multer
const fs = require('fs'); // 引入读取文件内容的 fs
const puppeteer = require('puppeteer'); // 引入 puppeteer 以生成 PDF 文件和截图
const TurndownService = require('turndown'); // 引入 turndown 以生成 markdown 文件
const session = require('express-session');  // 引入 express-session 模块
const helmet = require('helmet'); // 引入 Helmet 增加安全性
const rateLimit = require('express-rate-limit'); // 引入速率限制中间件
const path = require('path');


// 创建 Express 实例
const app = express();
const port = process.env.PORT || 3000; // 使用环境变量 PORT

// 配置 express-session
app.use(session({
    secret: 'your_secret_key',
    saveUninitialized: false,
    resave: false,
    cookie: { maxAge: 86400000 }  // 设置 cookie 过期时间
}));

// 使用 Helmet 来增加一些安全的 HTTP 头，并配置 CSP 允许内联事件处理器和字体加载
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:"],
            "font-src": ["'self'", "https:", "data:"],
            "connect-src": ["'self'"],
            "object-src": ["'none'"],
            "frame-ancestors": ["'none'"]
        }
    }
}));

// 应用速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 1000 // 限制每个 IP 每 15 分钟最多请求 1000 次
});
app.use(limiter);

// 创建生成 Markdown 文件实例
const turndownService = new TurndownService();

// 设置上传文件的存储路径
const upload = multer({dest: 'uploads/'});

// 定义全局变量

// 通用函数
// 用于准备下载内容，移除不需要的 HTML 元素，如按钮
function prepareContentForDownload(htmlContent) {
    // 移除所有按钮
    return htmlContent.replace(/<button[^>]*>(.*?)<\/button>/g, '');
}

function sanitizeFilename(title) {
    // 保持括号内的空格，只替换括号外的非法字符和空格
    let sanitizedTitle = title.replace(/[\s\[\]\{\},;@#?!&$]+/g, '_') // 替换特殊字符为下划线
                               .replace(/_+/g, '_') // 合并多个下划线为一个
                               .replace(/(^_+|_+$)/g, ''); // 移除首尾下划线

    // 特殊处理全角和半角括号，确保不在括号内的内容后添加下划线
    sanitizedTitle = sanitizedTitle.replace(/（/g, '（')
                                   .replace(/）/g, '）')
                                   .replace(/\(/g, '(')
                                   .replace(/\)/g, ')')
                                   .replace(/\(_/g, '(') // 确保英文开括号前不加下划线
                                   .replace(/_\)/g, ')'); // 确保英文闭括号前不加下划线

    return encodeURIComponent(sanitizedTitle);
}

// 解析 application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// 设置静态文件夹路径
app.use(express.static(path.join(__dirname, 'public')));

// 更新首页路径
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/locales/:lang', (req, res) => {
    const lang = req.params.lang;
    res.sendFile(path.join(__dirname, 'public', 'locales', `${lang}.json`));
});

// 更多路由及处理逻辑
// 生成 PDF
app.get('/download-pdf', async (req, res) => {
    if (!req.session.finalHtmlContent) {
        return res.status(404).send('No content available to generate PDF.');
    }

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // 设置页面内容为最近上传并处理的 HTML 内容
    
    let cleanContent = prepareContentForDownload(req.session.finalHtmlContent);
    cleanContent = cleanContent.replace(/<div class="header-container">.*?<\/div>/s, ''); // 移除顶部信息

    await page.setContent(cleanContent, {waitUntil: 'networkidle0'}); // 确保页面静态资源加载完成
    const pdf = await page.pdf({ format: 'A4' }); // 生成PDF

    await browser.close();

    // 设置响应头为PDF并发送生成的 PDF 文件
    res.contentType("application/pdf");
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(req.session.title)}.pdf"`);
    res.send(pdf);
});

// 生成 Markdown
app.get('/download-markdown', (req, res) => {
    const cleanContent = prepareContentForDownload(req.session.finalHtmlContent); // 清除生成文件里的下载按钮
    const markdown = turndownService.turndown(cleanContent);
    const filenameMd = `${sanitizeFilename(req.session.title)}.md`;
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(req.session.title)}.md"`);
    res.type('text/markdown');
    res.send(markdown);
});

// 生成网页截图
app.get('/download-screenshot', async (req, res) => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    let cleanContent = prepareContentForDownload(req.session.finalHtmlContent);
    cleanContent = cleanContent.replace(/<div class="header-container">.*?<\/div>/s, ''); // 移除顶部信息
    
    await page.setViewport({ width: 1280, height: 960, deviceScaleFactor: 2 }); // 设置截图质量
    await page.setContent(cleanContent, {waitUntil: 'networkidle0'});
    const screenshot = await page.screenshot({type: 'png', fullPage: true}); // 设置截图格式和范围
    const filenamePng = `${sanitizeFilename(req.session.title)}.png`;
    
    await browser.close();
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(req.session.title)}.png"`);
    res.type('image/png');
    res.send(screenshot);
});

// 处理上传文件

app.post('/upload', upload.single('notes'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const selectedFontStyle = req.body.fontStyle;
    const selectedLanguage = req.body.language || 'en'; // 获取用户选择的语言，默认为英语

    if (req.file.mimetype !== 'text/plain') {
        return res.status(400).send('Invalid file type. Only .txt files are allowed.');
    }

    if (req.file.size > 1048576) { // 1MB
        return res.status(400).send('File size exceeds limit. Maximum allowed size is 1MB.');
    }

    if (!selectedFontStyle) {
        return res.status(400).send('No font style selected.');
    }

    // 读取对应语言的 JSON 文件
    const languageFilePath = path.join(__dirname, 'public', 'locales', `${selectedLanguage}.json`);
    const languageData = JSON.parse(fs.readFileSync(languageFilePath, 'utf8'));

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.send('Error reading file.');
        }

        const lines = data.split(/\r\n|\r|\n/);
        const title = lines.shift();  // 获取第一行作为标题
        let content = "";
        let buffer = "";
        let inNote = false;

        lines.forEach((line, index) => {
            if (line.startsWith('Note:')) {
                if (buffer) {
                    content += `<div class="annotated"><blockquote class="highlighted">${buffer}</blockquote>`;
                    buffer = "";
                }
                buffer += `<p>${line.substring(5)}</p></div>`;
                inNote = true;
            } else if (line.trim() === '' && buffer) {
                if (!inNote) {
                    content += `<blockquote class="highlighted">${buffer}</blockquote>`;
                    buffer = "";
                } else {
                    if (index + 1 < lines.length && lines[index + 1].startsWith('Note:')) {
                        buffer += "<br>";
                    } else {
                        content += buffer;
                        buffer = "";
                        inNote = false;
                    }
                }
            } else if (line.trim() !== '') {
                if (buffer && inNote) {
                    buffer += `<br>${line}`;
                } else {
                    buffer = line;
                    inNote = false;
                }
            }
        });

        if (buffer) {
            content += `<blockquote class="highlighted">${buffer}</blockquote>`;
        } else {
            content += buffer;
        }

        req.session.processedContent = content;
        req.session.title = title;

        const templateStyle = selectedFontStyle === "serif" ? "template1.css" : "template2.css";
        const stylePath = path.join(__dirname, 'public', 'css', templateStyle);
        const templateStyleContent = fs.readFileSync(stylePath, 'utf8');
        const mainStyleContent = fs.readFileSync(path.join(__dirname, 'public', 'css', 'style.css'), 'utf8');

        req.session.finalHtmlContent = `
            <!DOCTYPE html>
            <html lang="${selectedLanguage}">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>${mainStyleContent}</style>
                <style>${templateStyleContent}</style>
                <script src="js/scripts.js" defer></script>
            </head>
            <body data-language="${selectedLanguage}">
                <div class="header-container">
                    <header>
                        <a href="/" class="site-name" id="bkn-link">BKN</a>
                    </header>
                </div>
                <main class="beautified">
                    <h1>${title}</h1>
                    <div class="corperation">
                        <button id="save-as-pdf" class="btn">${languageData.save_as_pdf}</button>
                        <button id="generate-markdown" class="btn">${languageData.generate_markdown}</button>
                        <button id="generate-screenshot" class="btn">${languageData.generate_screenshot}</button>
                    </div>
                    ${content}
                </main>
                <div class="footer-container">
                    <footer>
                        <div class="footer-content">
                            <p>${languageData.footer}</p>
                        </div>
                    </footer>
                </div>
            </body>
            </html>
        `;

        res.send(req.session.finalHtmlContent);
    });
});



// 处理模板选择

// 开启服务器，监听 0.0.0.0
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
});
