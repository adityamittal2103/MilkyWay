"""Minimal Blender .blend reader (supports Blender 5.0 large-BHead format). No Blender needed."""
import struct, mmap, collections, re

class Struct:
    __slots__=("name","size","fields","flist")
    def __init__(s,name,size,fields): s.name=name; s.size=size; s.fields=fields

class Field:
    __slots__=("type","name","base","ptr","arr","size","offset","is_fnptr")

class Blend:
    def __init__(self,path):
        f=open(path,'rb'); self.mm=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
        mm=self.mm
        if mm[7:9]==b'17':  # new header: BLENDER17-01v0500
            self.hsize=17; self.ptrsize=8; self.endian='<'; self.version=int(mm[13:17]); self.large=True
        else:
            self.hsize=12; self.ptrsize=8 if mm[7:8]==b'-' else 4; self.endian='<' if mm[8:9]==b'v' else '>'
            self.version=int(mm[9:12]); self.large=False
        self.blocks=[]; off=self.hsize
        E=self.endian
        while off<len(mm):
            code=mm[off:off+4]
            if self.large:
                sdna,old,ln,nr=struct.unpack_from(E+'iQqq',mm,off+4); hs=32
            else:
                if self.ptrsize==8:
                    ln,old,sdna,nr=struct.unpack_from(E+'iQii',mm,off+4); hs=24
                else:
                    ln,old,sdna,nr=struct.unpack_from(E+'iIii',mm,off+4); hs=20
            self.blocks.append((code,sdna,old,ln,nr,off+hs))
            if code==b'ENDB': break
            off+=hs+ln
        # ID blocks: globally addressable. DATA blocks: scoped to the preceding ID block.
        self.idmap={}; self.local={}; cur=None
        for b in self.blocks:
            if b[0]==b'DATA':
                if cur is not None: self.local[cur].setdefault(b[2],b)
                else: self.idmap.setdefault(b[2],b)
            else:
                cur=b[5]; self.local[cur]={}; self.idmap[b[2]]=b
        self.ctx=None
        dna=[b for b in self.blocks if b[0]==b'DNA1'][0]
        self._parse_dna(dna[5])
    def _parse_dna(self,off):
        mm=self.mm;E=self.endian; base=off
        al=lambda o: base+((o-base+3)&~3)
        assert mm[off:off+4]==b'SDNA'; off+=4
        def rd_strings(off):
            assert mm[off:off+4] in (b'NAME',b'TYPE'); off+=4
            n=struct.unpack_from(E+'i',mm,off)[0]; off+=4
            out=[]
            for _ in range(n):
                e=mm.find(b'\0',off); out.append(mm[off:e].decode('utf8','replace')); off=e+1
            off=al(off); return out,off
        names,off=rd_strings(off); types,off=rd_strings(off)
        assert mm[off:off+4]==b'TLEN'; off+=4
        tlen=struct.unpack_from(E+'%dh'%len(types),mm,off); off+=2*len(types); off=al(off)
        assert mm[off:off+4]==b'STRC'; off+=4
        ns=struct.unpack_from(E+'i',mm,off)[0]; off+=4
        self.names=names; self.types=types; self.tlen=tlen; self.structs=[]; self.sbyname={}
        for i in range(ns):
            t,nf=struct.unpack_from(E+'hh',mm,off); off+=4
            fields=[]; o=0
            for j in range(nf):
                ft,fn=struct.unpack_from(E+'hh',mm,off); off+=4
                F=Field(); F.type=types[ft]; F.name=names[fn]
                F.is_fnptr=F.name.startswith('(*')
                F.ptr=F.name.count('*') if not F.is_fnptr else 1
                m=re.match(r'[\*\(]*([A-Za-z0-9_]+)',F.name); F.base=m.group(1)
                arr=[int(x) for x in re.findall(r'\[(\d+)\]',F.name)]; F.arr=arr
                cnt=1
                for a in arr: cnt*=a
                el=self.ptrsize if F.ptr else tlen[ft]
                F.size=el*cnt; F.offset=o; o+=F.size
                fields.append(F)
            S=Struct(types[t],tlen[t],{f.base:f for f in fields}); S.flist=fields
            self.structs.append(S); self.sbyname[S.name]=S
    # ---- reading helpers
    def struct_of(self,b): return self.structs[b[1]]
    def get(self,off,S,field):
        F=S.fields[field]; E=self.endian; mm=self.mm; o=off+F.offset
        if F.ptr:
            fmt='Q' if self.ptrsize==8 else 'I'
            if F.arr: n=F.size//self.ptrsize; return list(struct.unpack_from(E+fmt*n,mm,o))
            return struct.unpack_from(E+fmt,mm,o)[0]
        t=F.type
        prim={'char':'b','uchar':'B','short':'h','ushort':'H','int':'i','uint':'I','float':'f','double':'d','int64_t':'q','uint64_t':'Q','int8_t':'b','int16_t':'h','int32_t':'i','uint32_t':'I','uint8_t':'B','uint16_t':'H','bool':'?'}
        if t=='char' and F.arr:
            raw=mm[o:o+F.size]; e=raw.find(b'\0'); return raw[:e if e>=0 else None].decode('utf8','replace')
        if t in prim:
            n=F.size//struct.calcsize(prim[t])
            v=struct.unpack_from(E+prim[t]*n,mm,o)
            return v if n>1 else v[0]
        return ('struct',o,self.sbyname.get(t))
    def blocks_code(self,code): return [b for b in self.blocks if b[0]==code]
    def deref(self,ptr,ctx=None):
        c=ctx if ctx is not None else self.ctx
        if c is not None and ptr in self.local.get(c,{}): return self.local[c][ptr]
        return self.idmap.get(ptr)
    def owner(self,b): return b[5]
    def data(self,b): return self.mm[b[5]:b[5]+b[3]]
