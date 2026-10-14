// Four colored quadrants make unintended import cropping detectable.
const zlib=require('node:zlib');
function crc32(b){let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return (c^0xffffffff)>>>0;}
function chunk(type,data){const b=Buffer.concat([Buffer.from(type),data]),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(b));return Buffer.concat([size,b,crc]);}
function png(w,h){const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=2;const rows=Buffer.alloc((w*3+1)*h),colors=[[255,0,0],[0,128,0],[0,0,255],[255,255,0]];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=colors[(y>=h/2?2:0)+(x>=w/2?1:0)],i=y*(w*3+1)+1+x*3;rows[i]=c[0];rows[i+1]=c[1];rows[i+2]=c[2];}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
module.exports=()=>[{name:'/qa-landscape.png',base64:png(1000,600).toString('base64')},{name:'/qa-portrait.png',base64:png(600,1000).toString('base64')}];
