# Installation

### From npm (after the package is published)

```bash
npm install ng-scheduler-kit
```

### From this Git repository

The library lives inside this Angular workspace, so build it first, then install the built package into your app:

```bash
git clone https://github.com/<your-user>/ng-scheduler-kit.git
cd ng-scheduler-kit
npm ci
npx ng build ng-scheduler-kit                 # → dist/ng-scheduler-kit

cd /path/to/your-angular-app
npm install /path/to/ng-scheduler-kit/dist/ng-scheduler-kit
# or: cd dist/ng-scheduler-kit && npm pack, then npm install the generated .tgz
```
