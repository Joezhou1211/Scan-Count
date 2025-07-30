let lastSelectedFile = null;

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
    const tableBody = $('#inventoryTable tbody');
    tableBody.empty();

    if ($.fn.DataTable.isDataTable('#inventoryTable')) {
        $('#inventoryTable').DataTable().clear().destroy();
    }

    data.slice(1).forEach(row => {
        const code = row[0] || '';
        const name = row[1] || '';
        const option1 = row[2] || '';
        const tr = `<tr>
            <td>${code}</td>
            <td>${name}</td>
            <td>${option1}</td>
            <td contenteditable="true" class="count-cell">0</td>
        </tr>`;
        tableBody.append(tr);
    });


    $('#inventoryTable').DataTable({
        "paging": true,
        "searching": true,
        "columnDefs": [
            { "orderable": false, "targets": 3 }
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
    let exportData = [['Code', 'Name', 'Option1', 'Count']];


    table.rows().every(function() {
        const row = this.node();
        const code = $(row).find('td:eq(0)').text();
        const name = $(row).find('td:eq(1)').text();
        const option1 = $(row).find('td:eq(2)').text();
        const count = $(row).find('td:eq(3)').text();
        exportData.push([code, name, option1, count]);
    });

    // 使用 SheetJS 生成并下载 .xlsx 文件
    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "InventoryData");

    // 导出 .xlsx 文件
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

const yesAudio = new Audio('static/yes.wav');
const noAudio = new Audio('static/no.mp3');
//设为最大音量
yesAudio.volume = 1;
noAudio.volume = 1;

// 播放提示音
function playSound(d) {
    if (d) {
        yesAudio.currentTime = 0;
        yesAudio.play();
    } else {
        noAudio.currentTime = 0;
        noAudio.play();
    }
}