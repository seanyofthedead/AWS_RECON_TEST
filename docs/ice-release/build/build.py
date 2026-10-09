import re,subprocess,sys,os
src_dir,out_dir,ref,tmp=sys.argv[1:5]
def widen(md):
    lines=md.split('\n'); out=[]; i=0
    while i<len(lines):
        if lines[i].startswith('|') and i+1<len(lines) and re.match(r'^\|(\s*:?-+:?\s*\|)+\s*$',lines[i+1]):
            j=i
            while j<len(lines) and lines[j].startswith('|'): j+=1
            rows=[ [c.strip() for c in l.strip().strip('|').split('|')] for k,l in enumerate(lines[i:j]) if k!=1]
            n=len(rows[0]); w=[]
            for c in range(n):
                L=[len(re.sub(r'\*|\[|\]','',r[c])) for r in rows if c<len(r)]
                lw=max(len(x) for r in rows if c<len(r) for x in re.sub(r'\*|\[|\]','',r[c]).split() or [''])
                w.append(max(lw*2.7+5,min(70,(max(L)+sum(L)/len(L))/2)))
            tot=sum(w); dashes=[max(3,round(60*x/tot)) for x in w]
            out.append(lines[i]); out.append('|'+'|'.join('-'*d for d in dashes)+'|'); out.extend(lines[i+2:j]); i=j
        else:
            out.append(lines[i]); i+=1
    return '\n'.join(out)
for name,outname in [("project-plan","ICE_AP_Intake_Project_Plan_DRAFT"),("conops","ICE_AP_Intake_CONOPS_DRAFT"),("cost-estimate","ICE_AP_Intake_Cost_Estimate_DRAFT")]:
    md=widen(open(os.path.join(src_dir,name+".md")).read())
    t=os.path.join(tmp,name+".md"); open(t,'w').write(md)
    subprocess.run(["pandoc",t,"-f","markdown+lists_without_preceding_blankline","--columns=10","-o",os.path.join(out_dir,outname+".docx"),"--reference-doc="+ref],check=True)
    import zipfile,shutil
    out=os.path.join(out_dir,outname+".docx"); t2=out+".tmp"
    with zipfile.ZipFile(out) as zin, zipfile.ZipFile(t2,"w",zipfile.ZIP_DEFLATED) as zout:
        for it in zin.infolist():
            data=zin.read(it.filename)
            if it.filename=="word/document.xml":
                x=data.decode()
                x=re.sub(r'<w:tr>(?!<w:trPr>)','<w:tr><w:trPr><w:cantSplit/></w:trPr>',x)
                x=x.replace('<w:tr><w:trPr>','<w:tr><w:trPr><w:cantSplit/>').replace('<w:cantSplit/><w:cantSplit/>','<w:cantSplit/>')
                data=x.encode()
            zout.writestr(it,data)
    shutil.move(t2,out)
    print(outname,"ok")
