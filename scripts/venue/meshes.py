import struct, numpy as np
from blendparse import Blend
class Reader:
    def __init__(s,path):
        B=s.B=Blend(path)
        s.S={n:B.sbyname[n] for n in ['ID','Mesh','Attribute','AttributeArray','AttributeStorage','Object','Material','Image','PackedFile','ListBase','ModifierData']}
    def idname(s,off): return s.B.get(off,s.S['ID'],'name')
    def cstr(s,p,ctx):
        b=s.B.deref(p,ctx); raw=s.B.data(b); return raw[:raw.find(b'\0')].decode('utf8','replace')
    def mesh(s,b):
        B=s.B; o=b[5]; S=s.S; ctx=o
        nv=B.get(o,S['Mesh'],'totvert'); np_=B.get(o,S['Mesh'],'totpoly'); nl=B.get(o,S['Mesh'],'totloop')
        aso=o+S['Mesh'].fields['attribute_storage'].offset
        ap=B.get(aso,S['AttributeStorage'],'dna_attributes'); n=B.get(aso,S['AttributeStorage'],'dna_attributes_num')
        attrs={}
        ab=B.deref(ap,ctx)
        for i in range(n):
            ao=ab[5]+i*S['Attribute'].size
            nm=s.cstr(B.get(ao,S['Attribute'],'name'),ctx); dt=B.get(ao,S['Attribute'],'data_type'); dom=B.get(ao,S['Attribute'],'domain'); st=B.get(ao,S['Attribute'],'storage_type')
            dp=B.get(ao,S['Attribute'],'data'); db=B.deref(dp,ctx)
            if st==0 and db:
                arr=B.get(db[5],S['AttributeArray'],'data'); sz=B.get(db[5],S['AttributeArray'],'size'); xb=B.deref(arr,ctx)
                attrs[nm]=(dt,dom,sz,xb)
            else: attrs[nm]=(dt,dom,st,db)
        po=B.get(o,S['Mesh'],'poly_offset_indices'); pb=B.deref(po,ctx)
        return dict(name=s.idname(o)[2:],nv=nv,np=np_,nl=nl,attrs=attrs,polyoffs=pb)
    def arr(s,xb,dtype,count,comps=1):
        a=np.frombuffer(s.B.mm,dtype=dtype,count=count*comps,offset=xb[5])
        return a.reshape(count,comps) if comps>1 else a

import math
def euler_to_mat(rx,ry,rz,mode):
    cx,sx=math.cos(rx),math.sin(rx); cy,sy=math.cos(ry),math.sin(ry); cz,sz=math.cos(rz),math.sin(rz)
    X=np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]]); Y=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]]); Z=np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
    order={1:'XYZ',2:'XZY',3:'YXZ',4:'YZX',5:'ZXY',6:'ZYX'}.get(mode,'XYZ')
    M={'X':X,'Y':Y,'Z':Z}
    # Blender 'XYZ' means X applied first -> R = Z @ Y @ X
    R=np.eye(3)
    for a in order: R=M[a]@R
    return R
def quat_to_mat(q):
    w,x,y,z=q; n=math.sqrt(w*w+x*x+y*y+z*z) or 1; w,x,y,z=w/n,x/n,y/n,z/n
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def axisangle_to_mat(axis,ang):
    ax=np.array(axis,float); n=np.linalg.norm(ax) or 1; ax/=n; x,y,z=ax; c,s=math.cos(ang),math.sin(ang); C=1-c
    return np.array([[c+x*x*C,x*y*C-z*s,x*z*C+y*s],[y*x*C+z*s,c+y*y*C,y*z*C-x*s],[z*x*C-y*s,z*y*C+x*s,c+z*z*C]])
def ob_local(R,o):
    B=R.B;S=R.S['Object']
    loc=np.add(B.get(o,S,'loc'),B.get(o,S,'dloc')); size=np.multiply(B.get(o,S,'size'),B.get(o,S,'dscale')); mode=B.get(o,S,'rotmode')
    if mode==0: Rm=quat_to_mat(B.get(o,S,'quat'))@quat_to_mat(B.get(o,S,'dquat'))
    elif mode==-1: Rm=axisangle_to_mat(B.get(o,S,'rotAxis'),B.get(o,S,'rotAngle'))
    else:
        r=np.add(B.get(o,S,'rot'),B.get(o,S,'drot')); Rm=euler_to_mat(*r,mode)
    M=np.eye(4); M[:3,:3]=Rm@np.diag(size); M[:3,3]=loc; return M
def world_mats(R):
    B=R.B;S=R.S['Object']; obs={b[2]:b for b in B.blocks_code(b'OB\0\0')}; cache={}
    def W(ptr):
        if ptr in cache: return cache[ptr]
        b=obs[ptr]; o=b[5]; L=ob_local(R,o); par=B.get(o,S,'parent')
        if par and par in obs:
            PI=np.array(B.get(o,S,'parentinv')).reshape(4,4).T  # stored column-major
            M=W(par)@PI@L
        else: M=L
        cache[ptr]=M; return M
    return {p:W(p) for p in obs}
