let lastSelectedFile = null;
let countColumnIndex = -1;

document.getElementById('fileUpload').addEventListener('change', function(event) {
    const fileInput = this;

    if ($.fn.DataTable.isDataTable('#inventoryTable') && $('#inventoryTable tbody tr').length > 0) {
        const userConfirmed = confirm("Do you want to Overwrite the current data?");
        if (!userConfirmed) {
            if (lastSelectedFile) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(lastSelectedFile);
                fileInput.files = dataTransfer.files;
            }
            return;
        }
    }

    lastSelectedFile = event.target.files[0];
    handleFileUpload(event);
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, {header: 1});
        populateTable(json);
    };
    reader.readAsArrayBuffer(file);
}

function populateTable(data) {
    const headers = data[0].map(h => (h || '').toString().trim());
    let codeIdx = -1;
    let nameIdx = -1;
    let countIdx = -1;

    headers.forEach((h, i) => {
        const lower = h.toLowerCase();
        if (lower === 'code') {
            codeIdx = i;
        } else if (lower === 'name' || lower === 'product name') {
            nameIdx = i;
        } else if (lower === 'count') {
            countIdx = i;
        }
    });

    if (nameIdx === -1) {
        headers.forEach((h, i) => {
            if (i === codeIdx || i === countIdx) return;
            const allRepair = data.slice(1).every(r => (r[i] || '').toString().toLowerCase().includes('repair'));
            if (allRepair) {
                nameIdx = i;
            }
        });
    }

    if (codeIdx === -1) {
        const msg = currentLanguage === 'en'
            ? 'Code column not found. Please rename the column to Code'
            : '未找到Code列，请重命名列名为Code';
        alert(msg);
        return;
    }

    if (nameIdx === -1) {
        const msg = currentLanguage === 'en'
            ? 'Name column not found. Please rename the column to Name'
            : '未找到Name列，请重命名Name列名为Name';
        alert(msg);
        return;
    }

    const otherIdx = [];
    headers.forEach((h, i) => {
        if (i !== codeIdx && i !== nameIdx && i !== countIdx && h) {
            otherIdx.push({header: h, index: i});
        }
    });

    const tableHead = $('#tableHeader');
    tableHead.empty();
    tableHead.append('<th>Code</th>');
    tableHead.append('<th>Name</th>');
    otherIdx.forEach(o => {
        tableHead.append(`<th>${o.header}</th>`);
    });
    tableHead.append('<th>Count</th>');

    const tableBody = $('#inventoryTable tbody');
    tableBody.empty();

    if ($.fn.DataTable.isDataTable('#inventoryTable')) {
        $('#inventoryTable').DataTable().clear().destroy();
    }

    data.slice(1).forEach(row => {
        const code = row[codeIdx] || '';
        const name = row[nameIdx] || '';
        const others = otherIdx.map(o => row[o.index] || '');
        const countVal = countIdx !== -1 ? (row[countIdx] || '0') : '0';

        let tr = '<tr>';
        tr += `<td contenteditable="true">${code}</td>`;
        tr += `<td contenteditable="true">${name}</td>`;
        others.forEach(v => { tr += `<td contenteditable="true">${v}</td>`; });
        tr += `<td contenteditable="true" class="count-cell">${countVal}</td>`;
        tr += '</tr>';
        tableBody.append(tr);
    });

    countColumnIndex = otherIdx.length + 2; // Code + Name + others

    $('#inventoryTable').DataTable({
        "paging": true,
        "searching": true,
        "columnDefs": [
            { "orderable": false, "targets": countColumnIndex }
        ]
    });

    restrictCountToNumbers();
}


function restrictCountToNumbers() {
    $('.count-cell').on('input', function(e) {
        const element = this;
        const selectionStart = getCaretPosition(element);
        const selectionEnd = selectionStart;

        let value = $(element).text();
        const newValue = value.replace(/[^\d\-]/g, '');

        if (value !== newValue) {
            $(element).text(newValue);
            setCursorPosition(element, selectionStart, selectionEnd);
        }
    });

    $('.count-cell').on('keydown', function(e) {
        // 允许的键：backspace(8), tab(9), enter(13), delete(46), 左右箭头(37, 39), 数字键(48-57), 小键盘数字键(96-105), 负号(109, 189), 小数点(110, 190)
        const allowedKeys = [8, 9, 13, 46, 37, 39, 109, 189, 110, 190];
        const isNumberKey = (e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105);

        if (!allowedKeys.includes(e.keyCode) && !isNumberKey) {
            e.preventDefault(); // 阻止非数字输入
        }
    });
}


function getCaretPosition(element) {
    const selection = window.getSelection();
    let caretOffset = 0;

    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;
    }

    return caretOffset;
}


function setCursorPosition(element, start, end) {
    const range = document.createRange();
    const selection = window.getSelection();

    range.setStart(element.firstChild, start);
    range.setEnd(element.firstChild, end);

    selection.removeAllRanges();
    selection.addRange(range);
}


$('#barcodeInput').on('keydown', function(e) {
    if (e.key === 'Enter') {
        const barcode = $(this).val().trim();
        updateCount(barcode);
        $(this).val('');
    }
});

function updateCount(barcode) {
    const table = $('#inventoryTable').DataTable();
    let found = false;

    table.rows().every(function() {
        const row = this.node();
        const code = $(row).find('td:first').text();
        const name = $(row).find('td:eq(1)').text();

        if (code === barcode) {
            const countCell = $(row).find('td:last');
            let count = parseInt(countCell.text()) || 0;
            countCell.text(count + 1);
            found = true;

            const message = currentLanguage === 'en'
                ? `1 of ${code} ${name} has been added`
                : `1个 ${code} ${name} 已添加`;
            playSound(true);
            document.getElementById('message').textContent = message;
            document.getElementById('message').style.color = 'green';
            return false; // 停止循环
        }
    });

    if (!found) {
        const notFoundMessage = currentLanguage === 'en'
            ? `${barcode} does not exist`
            : `${barcode} 不存在`;
        playSound(false);
        document.getElementById('message').textContent = notFoundMessage;
        document.getElementById('message').style.color = 'red';
    }
}


$('#copyBtn').on('click', function() {
    const table = $('#inventoryTable').DataTable();
    let clipboardContent = 'Code\tCount\n';


    table.rows().every(function() {
        const row = this.node();
        const code = $(row).find('td:first').text();
        const count = $(row).find('td:last').text();
        clipboardContent += `${code}\t${count}\n`;
    });


    copyToClipboard(clipboardContent);


    const copyMessage = currentLanguage === 'en'
        ? 'Data copied to clipboard'
        : 'Code 和 Count 列的数据已复制到剪贴板';
    document.getElementById('copyMessage').textContent = copyMessage;
});

// 复制到剪贴板
function copyToClipboard(text) {
    const tempElement = $('<textarea>');
    tempElement.val(text);
    $('body').append(tempElement);
    tempElement.select();
    document.execCommand('copy');
    tempElement.remove();
}

// 导出数据为 .xlsx 文件，包含所有页
$('#exportBtn').on('click', function() {
    const table = $('#inventoryTable').DataTable();
    let headers = [];
    $('#inventoryTable thead th').each(function(){
        headers.push($(this).text());
    });
    let exportData = [headers];

    table.rows().every(function() {
        const row = this.node();
        const cells = [];
        $(row).find('td').each(function(){
            cells.push($(this).text());
        });
        exportData.push(cells);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "InventoryData");
    XLSX.writeFile(workbook, 'inventory_data.xlsx');
});


let currentLanguage = 'zh';

// 切换语言按钮
document.getElementById('toggleLanguage').addEventListener('click', function () {
    const isEnglish = currentLanguage === 'zh';

    if (isEnglish) {
        currentLanguage = 'en';
        switchToEnglish();
    } else {
        currentLanguage = 'zh';
        switchToChinese();
    }
});

// 动态切换为英文文本
function switchToEnglish() {
    document.querySelector('h1').textContent = 'Stocktaking';
    document.getElementById('fileUpload').nextElementSibling.placeholder = 'Scan or manually input barcode';
    document.getElementById('copyBtn').textContent = 'Copy Data';
    document.getElementById('exportBtn').textContent = 'Export Complete Data';
    document.getElementById('message').textContent = '';
    document.getElementById('copyMessage').textContent = '';
    document.getElementById('helpBtn').textContent = 'Tutorial';
}

// 动态切换为中文文本
function switchToChinese() {
    document.querySelector('h1').textContent = '库存盘点';
    document.getElementById('fileUpload').nextElementSibling.placeholder = '扫码或手动输入条码';
    document.getElementById('copyBtn').textContent = '拷贝数据';
    document.getElementById('exportBtn').textContent = '输出完整数据';
    document.getElementById('message').textContent = '';
    document.getElementById('copyMessage').textContent = '';
    document.getElementById('helpBtn').textContent = '使用教程';
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let yesBuffer = null;
let noBuffer = null;

// 预加载音频，避免播放延迟
fetch('static/yes.wav')
    .then(r => r.arrayBuffer())
    .then(b => audioCtx.decodeAudioData(b))
    .then(buf => { yesBuffer = buf; });

fetch('static/no.mp3')
    .then(r => r.arrayBuffer())
    .then(b => audioCtx.decodeAudioData(b))
    .then(buf => { noBuffer = buf; });

// 在首次交互时恢复音频上下文
document.addEventListener('keydown', () => audioCtx.resume(), { once: true });
document.addEventListener('click', () => audioCtx.resume(), { once: true });

function playSound(success) {
    const buffer = success ? yesBuffer : noBuffer;
    if (!buffer) {
        return; // 音频尚未加载完成
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
}