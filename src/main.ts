// src/main.ts
import 'igniteui-webcomponents/themes/dark/indigo.css';
import './components/app';
import {
    defineComponents,
    IgcButtonComponent,
    IgcCardComponent,
    IgcCardHeaderComponent,
    IgcCardContentComponent,
    IgcCircularProgressComponent,
    IgcLinearProgressComponent,
    IgcSelectComponent,
    IgcSelectItemComponent,
    IgcTextareaComponent,
} from "igniteui-webcomponents";

defineComponents(
    IgcButtonComponent,
    IgcCardComponent,
    IgcCardHeaderComponent,
    IgcCardContentComponent,
    IgcCircularProgressComponent,
    IgcLinearProgressComponent,
    IgcSelectComponent,
    IgcSelectItemComponent,
    IgcTextareaComponent
);
