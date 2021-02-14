const fs = require("fs"),
  got = require("got"),
  yauzl = require("yauzl"),
  path = require("path");
function sleep(n){
  return new Promise((resolve) => {
    setTimeout(resolve, n * 1e3);
  });
}
module.exports = function initializeDatabase(MAIN_PATH){
  return new Promise((resolve, reject) => {
    const p = got.stream("https://archive.org/download/kahoot-win/json-full.zip").pipe(fs.createWriteStream(path.join(MAIN_PATH,"kdb.zip")));
    p.on("error",(e)=>{
      reject(e);
    });
    p.on("finish",()=>{
      yauzl.open(path.join(MAIN_PATH,"kdb.zip"),{lazyEntries: true},(err,zip)=>{
        if(err){return reject(err);}
        const {entryCount} = zip;
        let j = 0;
        zip.readEntry();
        zip.on("entry",entry=>{
          if(/\/$/.test(entry.fileName)){
            fs.mkdir(path.join(MAIN_PATH,entry.fileName), () => {
              zip.readEntry();
            });
          }else{
            zip.openReadStream(entry,(err,stream)=>{
              if(err){return reject(err);}
              stream.on("end",async ()=>{
                j++;
                if(j >= 500){
                  j = 0;
                  await sleep(0.2);
                }
                zip.readEntry();
              });
              stream.pipe(fs.createWriteStream(path.join(MAIN_PATH,entry.fileName)));
            });
          }
        });
        zip.once("end",async ()=>{
          fs.unlink(path.join(MAIN_PATH,"kdb.zip"), () => {});
          try{
            const {body} = await got("https://archive.org/download/kahoot-win/full-export-keys-sectioned-2.json");
            fs.writeFile(path.join(MAIN_PATH,"keys.json"), body, (e) =>{
              if(e){
                return reject(e);
              }
              resolve();
            });
          }catch(e){
            reject(e);
          }
        });
      });
    });
  });
}
