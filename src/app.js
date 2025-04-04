
import FCS from '../node_modules/fcs/fcs.js';
import Plotly from '../node_modules/plotly.js-dist';
import { pinv,multiply,transpose,abs,sign,log10,add,dotMultiply,matrix,median,subtract,exp,sqrt,max } from '../node_modules/mathjs';
import seedrandom from '../node_modules/seedrandom';


let logArray = [];

let directoryHandle;
let SavedirectoryHandle;
let UnmixfileHandle;
let csvArray;
let ChannelNames;
let A_Array;
let A_pinv;
let PSValueList;

let SCCfileHandle;
let fcsArray = [];
let fcsColumnNames = [];


// Select fcs Data folder
document.getElementById('select-folder').addEventListener('click', async () => {
    try {
        // Show the directory picker
        directoryHandle = await window.showDirectoryPicker();
        
        // Get the name of the selected folder
        const folderName = directoryHandle.name;
        
        // Display the folder name
        document.getElementById('folder-name').textContent = `Selected Folder: ${folderName}`;
        
    } catch (error) {
        console.error('Error selecting folder:', error);
        customLog('Error selecting folder:', error);
    }
});

// Select save folder
document.getElementById('select-save-folder').addEventListener('click', async () => {
    try {
        // Show the directory picker
        SavedirectoryHandle = await window.showDirectoryPicker();
        
        // Get the name of the selected folder
        const folderName = SavedirectoryHandle.name;
        
        // Display the folder name
        document.getElementById('save-folder-name').textContent = `Selected Folder: ${folderName}`;
        
    } catch (error) {
        console.error('Error selecting folder:', error);
        customLog('Error selecting folder:', error);
    }
});

// Select unmixing matrix csv file
document.getElementById('file-input').addEventListener('change', (event) => {
    const fileInput = event.target;
    if (fileInput.files.length > 0) {
        UnmixfileHandle = fileInput.files[0];
        const fileName = UnmixfileHandle.name;
        document.getElementById('file-name').textContent = `Selected File: ${fileName}`;
        customLog('Selected File: ' + fileName);
        document.getElementById('read-csv').disabled = false;
        
    }
});

// Read unmixing matrix csv file
document.getElementById('read-csv').addEventListener('click', async () => {
    try {
        if (!UnmixfileHandle) {
            alert('Please select a file first.');
            return;
        }

        // Read the file
        const text = await UnmixfileHandle.text();
        
        // Parse CSV content using PapaParse
        Papa.parse(text, {
            header: true,
            complete: function(results) {
                csvArray = results.data;
                console.log('CSV Array:', csvArray);
                customLog('CSV Array:', csvArray);
                ChannelNames = results.meta.fields;
                ChannelNames = ChannelNames.slice(2);
                console.log('ChannelNames:', ChannelNames);
                customLog('ChannelNames:', ChannelNames);
                // check if last row is empty
                if (csvArray.length > 0 && Object.values(csvArray[csvArray.length - 1]).every(value => value === "")) {
                    csvArray.pop(); // remove last row
                }
                
                let twoDimArray = csvArray.map(obj => Object.values(obj));
                A_Array = twoDimArray.map(row => row.slice(2).map(Number));//remove first two columns (primary and secondary labels)
                A_Array = transpose(A_Array);
                customLog('A_Array:', A_Array);

                PSValueList = csvArray.map(row => {
                    const primaryValue = row[Object.keys(row)[0]];
                    const secondaryValue = row[Object.keys(row)[1]];
                    return `${primaryValue} - ${secondaryValue}`;
                });
            }
        });

        //show csvArray
        displayCSVTable(csvArray);
        
        //calculate pinv matrix
        A_pinv = pinv(A_Array);
        customLog('A_pinv:', A_pinv);
        
    } catch (error) {
        console.error('Error reading CSV file:', error);
        customLog('Error reading CSV file:', error);
    }
});

// Display unmixing matrix csv file
function displayCSVTable(data) {
    const table = document.createElement('table');
    const headerRow = document.createElement('tr');

    // Create table headers
    Object.keys(data[0]).forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Create table rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        Object.values(row).forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });

    // Append table to the div
    document.getElementById('csv-table').innerHTML = '';
    document.getElementById('csv-table').appendChild(table);
}



// Read selected scc fcs file
document.getElementById('file-reading-button').addEventListener('click', async () => {
    if (!directoryHandle || !SavedirectoryHandle) {
        console.error('Please select both data and save folders.');
        return;
    }
    try {
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.fcs')) {
                
                const file = await entry.getFile();
                const reader = new FileReader();
                reader.onload = async function(e) {
                    let arrayBuffer = e.target.result;
                    console.log("arrayBuffer: ", arrayBuffer); 
                    customLog("arrayBuffer: ", "finished. ");
                    
                    let buffer = Buffer.from(arrayBuffer);
                    //arrayBuffer = null //remove arrayBuffer
                    console.log("buffer: ", buffer); 
                    customLog("buffer: ", "finished. ");
                    
                    let fcs = new FCS({ dataFormat: 'asNumber', eventsToRead: -1}, buffer);
                    //let fcs = new FCS(arrayBuffer);
                    buffer = null //remove buffer
                    console.log("fcs: ", fcs); 

                    // fcsColumnNames
                    const text = fcs.text;
                    let newText = { ...fcs.text };//for update
                    const copyanalysis = fcs.analysis;
                    const copyothers = fcs.others;
                    let columnNames = [];
                    //columnNames are stored in `$P${i}S` in Xenith
                    for (let i = 1; text[`$P${i}S`]; i++) {
                        columnNames.push(text[`$P${i}S`]);
                    }
                    //columnNames are stored in `$P${i}N` in Aurora
                    if (columnNames.length == 0) {
                        for (let i = 1; text[`$P${i}N`]; i++) {
                            columnNames.push(text[`$P${i}N`]);
                        }
                    }
                    fcsColumnNames = columnNames;
                    
                    // fcsArray
                    fcsArray = fcs.dataAsNumbers; 
                    //fcs = null; //remove fcs
                    console.log("fcsArray: ", fcsArray);
                    console.log("Column Names: ", fcsColumnNames);
                    customLog("fcsArray: ", "finished.");
                    customLog('Column Names:', fcsColumnNames);

                    // check if all ChannelNames is in fcsColumnNames
                    if (1) {
                        // check if all ChannelNames is in fcsColumnNames
                        const notInfcsColumnNames = ChannelNames.filter(channel => !fcsColumnNames.includes(channel));
                        //reminder of check results
                        if (notInfcsColumnNames.length > 0) {
                            
                            customLog(`These following channels were not found in the fcs file: ${notInfcsColumnNames.join(', ')} Please check before moving on.`);
                            
                            customLog(`Channels found in the fcs file: ${ChannelNames.join(', ')}`);
                        } else {
                        
                            customLog('All channels in unmixing matrix are in the fcs file.');
                        }
                    } 
                    //do unmixing
                    let filteredfcsArrayforUnmix = filterFCSArrayByChannelNames(fcsArray, fcsColumnNames, ChannelNames);
                    const unmixedData = unmixing(filteredfcsArrayforUnmix,A_pinv);
                    
                    const Par_range = max(unmixedData)
                    const combinedData = fcsArray.map((row, index) => row.concat(unmixedData[index]));
                    //update text
                    const originalParameterCount =  filteredfcsArrayforUnmix[0].length;
                    filteredfcsArrayforUnmix = null
                    const newParameterCount = originalParameterCount + unmixedData[0].length;
                    newText['$PAR'] = newParameterCount.toString();
                    for (let i = originalParameterCount + 1; i <= newParameterCount; i++) {
                        newText[`$P${i}N`] = PSValueList[i - originalParameterCount - 1];
                        newText[`$P${i}S`] = PSValueList[i - originalParameterCount - 1];
                        newText[`$P${i}R`] = Par_range.toString(); // range of parameter
                        newText[`$P${i}B`] = '32';  //number of bits
                        newText[`$P${i}E`] = '0,0'; //Amplification type
                    }
                    // 定义保留字段列表和正则表达式
                    const reservedFields = [
                        '$BEGINANALYSIS', '$BEGINDATA', '$BEGINSTEXT', '$BYTEORD', '$DATATYPE', 
                        '$ENDANALYSIS', '$ENDDATA', '$ENDSTEXT', '$MODE', '$NEXTDATA', '$PAR', 
                        '$TOT'
                    ];
                    const parameterFieldsRegex = /^\$P\d+[BERSN]$/;

                    const sortedText = {};
                    Object.keys(newText).sort((a, b) => {
                        const aIsReserved = reservedFields.includes(a) || parameterFieldsRegex.test(a);
                        const bIsReserved = reservedFields.includes(b) || parameterFieldsRegex.test(b);

                        // 如果a是保留字段且b不是，则a排在前面
                        if (aIsReserved && !bIsReserved) {
                            return -1;
                        }
                        // 如果b是保留字段且a不是，则b排在前面
                        if (bIsReserved && !aIsReserved) {
                            return 1;
                        }
                        // 如果a是普通字段且b是#开头的字段，则a排在前面
                        if (!a.startsWith('#') && b.startsWith('#')) {
                            return -1;
                        }
                        // 如果b是普通字段且a是#开头的字段，则b排在前面
                        if (!b.startsWith('#') && a.startsWith('#')) {
                            return 1;
                        }
                        // 否则按字母顺序排序
                        return a.localeCompare(b);
                    }).forEach(key => {
                        sortedText[key] = newText[key];
                    });
                    
                    


                    // create new fcs file
                    let newFCSData = new FCS();
                    newFCSData.dataAsNumbers = combinedData
                    newFCSData.analysis = {}
                    newFCSData.text = sortedText

                    let file_name = `unmixed_${entry.name}`
                    writeFCSFile(newFCSData, SavedirectoryHandle,file_name)

                    console.log(`Processed and saved: unmixed_${entry.name}`);

                }
                reader.readAsArrayBuffer(file);

            }
        }
    }catch (error) {
        console.error('Error processing files:', error);
        customLog('Error processing files:', error);
    }

});


async function writeFCSFile(fcsData, SavedirectoryHandle,file_name) {
    //demo
    // 示例HEADER段
    //const header = 'FCS3.1    256    512    1024'; 
    // 示例TEXT段
    //const text = '$BEGINANALYSIS 512\n$BEGINDATA 1024\n$BYTEORD 1,2,3,4\n$DATATYPE I\n$MODE L\n$PAR 2\n$TOT 1000\n$P1B 16\n$P1N FSC\n$P2B 16\n$P2N SSC'; 
    // 示例二维数组数据段
    //const my2DArray = [
    //    [1, 2, 3],
    //    [4, 5, 6],
    //    [7, 8, 9]
    //]; 

   
    // 将TEXT段转换为Buffer
    const formated_text = formatTextSegment(fcsData)
    const textBlob = Buffer.from(formated_text);

    // 将二维数组转换为二进制数据
    let data = fcsData.dataAsNumbers
    let dataBlob
    dataBlob = convert2DArrayToBinary(data);
    let totalDataLength = dataBlob.byteLength
    console.log(`总字节长度: ${totalDataLength}`);
    // 将HEADER段转换为Buffer
    const formated_head = calculateHeader(formated_text,totalDataLength)
    const headerBlob = Buffer.from(formated_head);

    // 创建一个缓冲区来存储整个文件内容
    //const fileBuffer = Buffer.concat([headerBuffer, textBuffer, dataBuffer]);
    const fileBlob = new Blob([headerBlob, textBlob, dataBlob], { type: 'application/octet-stream' });


    // 将缓冲区写入文件
    // save new fcs file
    const newFileHandle = await SavedirectoryHandle.getFileHandle(file_name, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(fileBlob);
    await writable.close();

    save_log()
    
}

function convert2DArrayToBinary(data) {
    // 创建一个缓冲区数组来存储二进制数据
    let bufferArray = [];
    let totalLength = 0;

    // 遍历二维数组，将每个元素转换为二进制数据并添加到缓冲区数组
    data.forEach(row => {
        row.forEach(value => {
            let valueBuffer = new ArrayBuffer(4); // 分配4个字节（32位）来存储浮点数
            let view = new DataView(valueBuffer);
            view.setFloat32(0, value, true); // 以小端字节序写入浮点数
            bufferArray.push(new Uint8Array(valueBuffer));
            totalLength += valueBuffer.byteLength; // 累加每个缓冲区的字节长度
        });
    });

    // 合并缓冲区数组
    const binaryData = Buffer.concat(bufferArray);

    return binaryData;
}


function formatTextSegment(fcsData) {
    let text = fcsData.text
    let formattedText = '';

    for (let key in text) {
        if (text.hasOwnProperty(key)) {
            formattedText += `*${key}*${text[key]}`;
        }
    }
    formattedText += `*`
    return formattedText;
}



function calculateHeader(formattedText,totalDataLength) {
    const header = {};

    header.FCSVersion = 'FCS3.1    ';

    const textStart = 58; // usually 
    const textEnd = textStart + formattedText.length - 1;

    const dataStart = textEnd + 1;
    const dataEnd = dataStart + totalDataLength - 1; // 4个字节（32位）

    // header
    header.beginText = textStart.toString().padStart(8, ' ');
    header.endText = textEnd.toString().padStart(8, ' ');
    header.beginData = dataStart.toString().padStart(8, ' ');
    header.endData = dataEnd.toString().padStart(8, ' ');

    // Analysis
    header.beginAnalysis = '0'.padStart(8, ' ');
    header.endAnalysis = '0'.padStart(8, ' ');

    return `${header.FCSVersion}${header.beginText}${header.endText}${header.beginData}${header.endData}${header.beginAnalysis}${header.endAnalysis}`;
}



function filterFCSArrayByChannelNames(fcsArray, fcsColumnNames, ChannelNames) {
    // Create an array to store the indices of the columns to keep
    const indicesToKeep = ChannelNames.map(channel => fcsColumnNames.indexOf(channel)).filter(index => index !== -1);

    // Filter the fcsArray to keep only the columns with the specified indices
    const filteredFCSArray = fcsArray.map(row => indicesToKeep.map(index => row[index]));

    return filteredFCSArray;
}


function unmixing(fcsArray,A_pinv) {
    let fcsArray_T = transpose(fcsArray);
    console.log("fcsArray_T: ", fcsArray_T);
    console.log("A_pinv: ", A_pinv);
    let unmixedMatrix = multiply(A_pinv, fcsArray_T);
    fcsArray_T = null
    unmixedMatrix = transpose(unmixedMatrix);
    return unmixedMatrix;
}

function customLog(...args) {
    const timestamp = new Date().toISOString(); 
    const logEntry = `[${timestamp}] ${args.join(' ')}`;
    logArray.push(logEntry);
    console.log.apply(console, [logEntry]); 
}

function save_log(){
    const logContent = logArray.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'console_log.txt';
    a.click();
    URL.revokeObjectURL(url);
}


//npm run build