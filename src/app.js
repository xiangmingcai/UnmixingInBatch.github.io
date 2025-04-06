
import FCS from '../node_modules/fcs/fcs.js';
import { pinv,multiply,transpose,ceil,max} from '../node_modules/mathjs';
import JSWriteFCS from '../node_modules/jswritefcs/JSWriteFCS.js';

let logArray = [];

let directoryHandle;
let SavedirectoryHandle;
let UnmixfileHandle;
let csvArray;
let ChannelNames;
let A_Array;
let A_pinv;
let PSValueList;

let fcsArray = [];
let fcsColumnNames = [];
let logfile_name;


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
        
        // Request permission
        await SavedirectoryHandle.requestPermission({ mode: 'readwrite' });
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
                //customLog('A_Array:', A_Array);

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
        //customLog('A_pinv:', A_pinv);
        
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
        const now = new Date();
        logfile_name = `log_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}_${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}.txt`;
        
        let totalFiles = 0;
        let processedFiles = 0;
        const fileHandle_all = [];
        // iterate files
        for await (const fileHandle of directoryHandle.values()) {
            totalFiles++;
            fileHandle_all.push(fileHandle);
        }
        console.log("totalFiles: ",totalFiles);
        
        for await (const fileHandle of fileHandle_all) {
            //update progress bar
            processedFiles ++;
            update_progress(processedFiles,totalFiles);
            //process file
            await processFile(fileHandle);
            customLog("fileHandle: ",fileHandle);
            //save log
            save_log(logfile_name);
            //await new Promise(resolve => setTimeout(resolve, 0));
        }
        document.getElementById('progress-text').textContent = 'Processing complete!';

    }catch (error) {
        console.error('Error processing files:', error);
        customLog('Error processing files:', error);
    }

});


async function processFile(fileHandle) {
    if (fileHandle.kind === 'file' && fileHandle.name.endsWith('.fcs')) {

        const file = await fileHandle.getFile();
        let file_name = `unmixed_${fileHandle.name}`;
        //write unmixed fcs file
        const writer = await readFileAsArrayBuffer(file);
        await writer.writeFCS(file_name,SavedirectoryHandle);

        customLog(`Processed and saved: unmixed_${fileHandle.name}`);
        
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            let arrayBuffer = e.target.result;
            //console.log("arrayBuffer: ", arrayBuffer); 
            customLog("arrayBuffer: ", "finished. ");

            let buffer = Buffer.from(arrayBuffer);
            arrayBuffer = null //remove arrayBuffer
            //console.log("buffer: ", buffer); 
            customLog("buffer: ", "finished. ");

            let fcs = new FCS({ dataFormat: 'asNumber', eventsToRead: -1}, buffer);
            //let fcs = new FCS(arrayBuffer);
            buffer = null //remove buffer
            console.log("fcs: ", fcs); 

            // fcsColumnNames
            const text = fcs.text;
            let newText = { ...fcs.text };//for update
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
            //console.log("fcsArray: ", fcsArray);
            //console.log("Column Names: ", fcsColumnNames);
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
            let unmixedData = unmixing(filteredfcsArrayforUnmix,A_pinv);
            
            const Par_range = ceil(max(unmixedData))
            let combinedData = fcsArray.map((row, index) => row.concat(unmixedData[index]));
            fcsArray = [];

            //update text
            const originalParameterCount =  fcs.meta.$PAR;
            filteredfcsArrayforUnmix = null
            const newParameterCount = originalParameterCount + unmixedData[0].length;
            unmixedData = null;
            newText['$PAR'] = newParameterCount.toString();
            for (let i = originalParameterCount + 1; i <= newParameterCount; i++) {
                newText[`$P${i}N`] = PSValueList[i - originalParameterCount - 1];
                newText[`$P${i}S`] = PSValueList[i - originalParameterCount - 1];
                newText[`$P${i}R`] = Par_range.toString(); // range of parameter
                newText[`$P${i}B`] = '32';  //number of bits
                newText[`$P${i}E`] = '0,0'; //Amplification type
            }

            // save fcs file
            let writer = new JSWriteFCS(fcs.header,newText,combinedData);
            
            resolve(writer);
        };
        reader.onerror = function(error) {
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
}


function update_progress(processedFiles,totalFiles){
    const progress = (processedFiles / totalFiles) * 100;
    document.getElementById('progress-bar').value = progress;
    document.getElementById('progress-text').textContent = `Processing ${processedFiles} of ${totalFiles} files...`;
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
    //console.log("fcsArray_T: ", fcsArray_T);
    //console.log("A_pinv: ", A_pinv);
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

async function save_log(logfile_name){
    
    console.log(logfile_name)
    const logContent = logArray.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });


    const newFileHandle = await SavedirectoryHandle.getFileHandle(logfile_name, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(blob);
    writable.close();

}


//npm run build