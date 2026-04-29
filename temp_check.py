with open(r'C:\meu-diva\front\components\calendar\CalendarPatient.tsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()
for i, line in enumerate(content.splitlines()):
    if 'BACKEND_URL' in line and 'foto' in line:
        print(repr(line))
