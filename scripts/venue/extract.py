"""Extract world-space triangle soup per object from the .blend."""
import sys,struct,re,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0])
from meshes import *
def load(path):
    R=Reader(path); B=R.B; S=R.S['Object']; W=world_mats(R)
    meshmap={b[2]:b for b in B.blocks_code(b'ME\0\0')}
    out=[]
    for ptr,M in W.items():
        b=B.idmap[ptr]; o=b[5]
        if B.get(o,S,'type')!=1: continue
        mb=meshmap.get(B.get(o,S,'data')); m=R.mesh(mb)
        if m['nv']==0 or m['np']==0 or 'position' not in m['attrs'] or '.corner_vert' not in m['attrs']: continue
        P=R.arr(m['attrs']['position'][3],np.float32,m['nv'],3).astype(np.float64)
        cv=R.arr(m['attrs']['.corner_vert'][3],np.int32,m['nl'])
        po=R.arr(m['polyoffs'],np.int32,m['np']+1)
        mi=R.arr(m['attrs']['material_index'][3],np.int32,m['np']) if 'material_index' in m['attrs'] and m['attrs']['material_index'][3] else np.zeros(m['np'],np.int32)
        uv=R.arr(m['attrs']['UVMap'][3],np.float32,m['nl'],2) if 'UVMap' in m['attrs'] and m['attrs']['UVMap'][3] else None
        Pw=(M[:3,:3]@P.T).T+M[:3,3]
        out.append(dict(ob=o,name=R.idname(o)[2:],mesh=m['name'],M=M,P=Pw,Plocal=P,cv=cv,po=po,mi=mi,uv=uv,meshptr=mb[2]))
    return R,out
def fan(po):
    """Return (tri corner indices Nx3, face index per tri) via fan triangulation."""
    sizes=np.diff(po); nt=sizes-2; tot=int(nt.sum())
    face=np.repeat(np.arange(len(sizes)),nt)
    start=np.repeat(po[:-1],nt)
    k=np.arange(tot)-np.repeat(np.cumsum(nt)-nt,nt)
    return np.stack([start,start+k+1,start+k+2],1),face
