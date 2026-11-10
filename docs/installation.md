# Installation

### From npm (after the package is published)

```bash
npm install ng-fullcalender
```

### From this Git repository

The library lives inside this Angular workspace, so build it first, then install the built package into your app:

```bash
git clone https://github.com/siva-geddada/ng-fullCalender.git
cd ng-fullcalender
npm ci
npx ng build ng-fullcalender                 # → dist/ng-fullcalender

cd /path/to/your-angular-app
npm install /path/to/ng-fullcalender/dist/ng-fullcalender
# or: cd dist/ng-fullcalender && npm pack, then npm install the generated .tgz
```
