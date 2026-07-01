BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[account] (
    [AccountNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [AcctType] INT,
    [BankNumber] VARCHAR(255),
    [Inactive] INT,
    [AccountColor] INT,
    [IsRetainedEarnings] INT,
    CONSTRAINT [PK__account__B9572BDAA2619468] PRIMARY KEY CLUSTERED ([AccountNum])
);

-- CreateTable
CREATE TABLE [dbo].[accountingautopay] (
    [AccountingAutoPayNum] BIGINT NOT NULL,
    [PayType] BIGINT,
    [PickList] BIGINT,
    CONSTRAINT [PK__accounti__03ADEB32830D4739] PRIMARY KEY CLUSTERED ([AccountingAutoPayNum])
);

-- CreateTable
CREATE TABLE [dbo].[activeinstance] (
    [ActiveInstanceNum] BIGINT NOT NULL,
    [ComputerNum] BIGINT,
    [UserNum] BIGINT,
    [ProcessId] BIGINT,
    [DateTimeLastActive] DATETIME2,
    [DateTRecorded] DATETIME2,
    [ConnectionType] INT,
    CONSTRAINT [PK__activein__502E0F78E80DF979] PRIMARY KEY CLUSTERED ([ActiveInstanceNum])
);

-- CreateTable
CREATE TABLE [dbo].[adjustment] (
    [AdjNum] BIGINT NOT NULL,
    [AdjDate] DATE,
    [AdjAmt] FLOAT(53),
    [PatNum] BIGINT,
    [AdjType] BIGINT,
    [ProvNum] BIGINT,
    [AdjNote] TEXT,
    [ProcDate] DATE,
    [ProcNum] BIGINT,
    [DateEntry] DATE,
    [ClinicNum] BIGINT,
    [StatementNum] BIGINT,
    [SecUserNumEntry] BIGINT,
    [SecDateTEdit] DATETIME2,
    [TaxTransID] BIGINT,
    CONSTRAINT [PK__adjustme__C3BC0165DA0661D1] PRIMARY KEY CLUSTERED ([AdjNum])
);

-- CreateTable
CREATE TABLE [dbo].[alertcategory] (
    [AlertCategoryNum] BIGINT NOT NULL,
    [IsHQCategory] INT,
    [InternalName] VARCHAR(255),
    [Description] VARCHAR(255),
    CONSTRAINT [PK__alertcat__1130B53D6706DE47] PRIMARY KEY CLUSTERED ([AlertCategoryNum])
);

-- CreateTable
CREATE TABLE [dbo].[alertcategorylink] (
    [AlertCategoryLinkNum] BIGINT NOT NULL,
    [AlertCategoryNum] BIGINT,
    [AlertType] INT,
    CONSTRAINT [PK__alertcat__BB2DA0E7643DEC24] PRIMARY KEY CLUSTERED ([AlertCategoryLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[alertitem] (
    [AlertItemNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [Description] VARCHAR(2000),
    [Type] INT,
    [Severity] INT,
    [Actions] INT,
    [FormToOpen] INT,
    [FKey] BIGINT,
    [ItemValue] VARCHAR(4000),
    [UserNum] BIGINT,
    [SecDateTEntry] DATETIME2,
    CONSTRAINT [PK__alertite__3FAA0561E4E974C8] PRIMARY KEY CLUSTERED ([AlertItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[alertread] (
    [AlertReadNum] BIGINT NOT NULL,
    [AlertItemNum] BIGINT,
    [UserNum] BIGINT,
    CONSTRAINT [PK__alertrea__C496E3EB5946B67D] PRIMARY KEY CLUSTERED ([AlertReadNum])
);

-- CreateTable
CREATE TABLE [dbo].[alertsub] (
    [AlertSubNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [ClinicNum] BIGINT,
    [Type] INT,
    [AlertCategoryNum] BIGINT,
    CONSTRAINT [PK__alertsub__8C258EF8C8F2667B] PRIMARY KEY CLUSTERED ([AlertSubNum])
);

-- CreateTable
CREATE TABLE [dbo].[allergy] (
    [AllergyNum] BIGINT NOT NULL,
    [AllergyDefNum] BIGINT,
    [PatNum] BIGINT,
    [Reaction] VARCHAR(255),
    [StatusIsActive] INT,
    [DateTStamp] DATETIME2,
    [DateAdverseReaction] DATE,
    [SnomedReaction] VARCHAR(255),
    CONSTRAINT [PK__allergy__AC4FB0393373BF2A] PRIMARY KEY CLUSTERED ([AllergyNum])
);

-- CreateTable
CREATE TABLE [dbo].[allergydef] (
    [AllergyDefNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [IsHidden] INT,
    [DateTStamp] DATETIME2,
    [SnomedType] INT,
    [MedicationNum] BIGINT,
    [UniiCode] VARCHAR(255),
    CONSTRAINT [PK__allergyd__8285D8177A56009B] PRIMARY KEY CLUSTERED ([AllergyDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[apikey] (
    [APIKeyNum] BIGINT NOT NULL,
    [CustApiKey] VARCHAR(255),
    [DevName] VARCHAR(255),
    CONSTRAINT [PK__apikey__58E796144950DC40] PRIMARY KEY CLUSTERED ([APIKeyNum])
);

-- CreateTable
CREATE TABLE [dbo].[apisubscription] (
    [ApiSubscriptionNum] BIGINT NOT NULL,
    [EndPointUrl] VARCHAR(255),
    [Workstation] VARCHAR(255),
    [CustomerKey] VARCHAR(255),
    [WatchTable] VARCHAR(255),
    [PollingSeconds] INT,
    [UiEventType] VARCHAR(255),
    [DateTimeStart] DATETIME2,
    [DateTimeStop] DATETIME2,
    [Note] VARCHAR(255),
    CONSTRAINT [PK__apisubsc__D3F52D2ECDB1B648] PRIMARY KEY CLUSTERED ([ApiSubscriptionNum])
);

-- CreateTable
CREATE TABLE [dbo].[appointment] (
    [AptNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [AptStatus] INT,
    [Pattern] VARCHAR(255),
    [Confirmed] BIGINT,
    [TimeLocked] INT,
    [Op] BIGINT,
    [Note] TEXT,
    [ProvNum] BIGINT,
    [ProvHyg] BIGINT,
    [AptDateTime] DATETIME2,
    [NextAptNum] BIGINT,
    [UnschedStatus] BIGINT,
    [IsNewPatient] INT,
    [ProcDescript] TEXT,
    [Assistant] BIGINT,
    [ClinicNum] BIGINT,
    [IsHygiene] INT,
    [DateTStamp] DATETIME2,
    [DateTimeArrived] DATETIME2,
    [DateTimeSeated] DATETIME2,
    [DateTimeDismissed] DATETIME2,
    [InsPlan1] BIGINT,
    [InsPlan2] BIGINT,
    [DateTimeAskedToArrive] DATETIME2,
    [ProcsColored] TEXT,
    [ColorOverride] INT,
    [AppointmentTypeNum] BIGINT,
    [SecUserNumEntry] BIGINT,
    [SecDateTEntry] DATETIME2,
    [Priority] INT,
    [ProvBarText] VARCHAR(60),
    [PatternSecondary] VARCHAR(255),
    [SecurityHash] VARCHAR(255),
    [ItemOrderPlanned] INT,
    [IsMirrored] INT,
    CONSTRAINT [PK__appointm__656D61EFD3979904] PRIMARY KEY CLUSTERED ([AptNum])
);

-- CreateTable
CREATE TABLE [dbo].[appointmentrule] (
    [AppointmentRuleNum] BIGINT NOT NULL,
    [RuleDesc] VARCHAR(255),
    [CodeStart] VARCHAR(15),
    [CodeEnd] VARCHAR(15),
    [IsEnabled] INT,
    CONSTRAINT [PK__appointm__A85235FDD3C98C0F] PRIMARY KEY CLUSTERED ([AppointmentRuleNum])
);

-- CreateTable
CREATE TABLE [dbo].[appointmenttype] (
    [AppointmentTypeNum] BIGINT NOT NULL,
    [AppointmentTypeName] VARCHAR(255),
    [AppointmentTypeColor] INT,
    [ItemOrder] INT,
    [IsHidden] INT,
    [Pattern] VARCHAR(255),
    [CodeStr] VARCHAR(4000),
    [CodeStrRequired] VARCHAR(4000),
    [RequiredProcCodesNeeded] INT,
    [BlockoutTypes] VARCHAR(255),
    CONSTRAINT [PK__appointm__B1F8BC5BF8BEF60B] PRIMARY KEY CLUSTERED ([AppointmentTypeNum])
);

-- CreateTable
CREATE TABLE [dbo].[apptfield] (
    [ApptFieldNum] BIGINT NOT NULL,
    [AptNum] BIGINT,
    [FieldName] VARCHAR(255),
    [FieldValue] TEXT,
    CONSTRAINT [PK__apptfiel__0ACC373406505399] PRIMARY KEY CLUSTERED ([ApptFieldNum])
);

-- CreateTable
CREATE TABLE [dbo].[apptfielddef] (
    [ApptFieldDefNum] BIGINT NOT NULL,
    [FieldName] VARCHAR(255),
    [FieldType] INT,
    [PickList] TEXT,
    [ItemOrder] INT,
    CONSTRAINT [PK__apptfiel__5010AD38511737F7] PRIMARY KEY CLUSTERED ([ApptFieldDefNum]),
    CONSTRAINT [UQ__apptfiel__A88707A64ED94059] UNIQUE NONCLUSTERED ([FieldName])
);

-- CreateTable
CREATE TABLE [dbo].[apptgeneralmessagesent] (
    [ApptGeneralMessageSentNum] BIGINT NOT NULL,
    [ApptNum] BIGINT,
    [PatNum] BIGINT,
    [ClinicNum] BIGINT,
    [DateTimeEntry] DATETIME2,
    [TSPrior] BIGINT,
    [ApptReminderRuleNum] BIGINT,
    [SendStatus] INT,
    [ApptDateTime] DATETIME2,
    [MessageType] INT,
    [MessageFk] BIGINT,
    [DateTimeSent] DATETIME2,
    [ResponseDescript] TEXT,
    CONSTRAINT [PK__apptgene__6362AEDA0740C7AA] PRIMARY KEY CLUSTERED ([ApptGeneralMessageSentNum])
);

-- CreateTable
CREATE TABLE [dbo].[apptnewpatthankyousent] (
    [ApptNewPatThankYouSentNum] BIGINT NOT NULL,
    [ApptNum] BIGINT,
    [ApptDateTime] DATETIME2,
    [ApptSecDateTEntry] DATETIME2,
    [TSPrior] BIGINT,
    [ApptReminderRuleNum] BIGINT,
    [ClinicNum] BIGINT,
    [PatNum] BIGINT,
    [ResponseDescript] TEXT,
    [DateTimeNewPatThankYouTransmit] DATETIME2,
    [ShortGUID] VARCHAR(255),
    [SendStatus] INT,
    [MessageType] INT,
    [MessageFk] BIGINT,
    [DateTimeEntry] DATETIME2,
    [DateTimeSent] DATETIME2,
    CONSTRAINT [PK__apptnewp__6437923F409F779A] PRIMARY KEY CLUSTERED ([ApptNewPatThankYouSentNum])
);

-- CreateTable
CREATE TABLE [dbo].[apptreminderrule] (
    [ApptReminderRuleNum] BIGINT NOT NULL,
    [TypeCur] INT,
    [TSPrior] BIGINT,
    [SendOrder] VARCHAR(255),
    [IsSendAll] INT,
    [TemplateSMS] TEXT,
    [TemplateEmailSubject] TEXT,
    [TemplateEmail] TEXT,
    [ClinicNum] BIGINT,
    [TemplateSMSAggShared] TEXT,
    [TemplateSMSAggPerAppt] TEXT,
    [TemplateEmailSubjAggShared] TEXT,
    [TemplateEmailAggShared] TEXT,
    [TemplateEmailAggPerAppt] TEXT,
    [DoNotSendWithin] BIGINT,
    [IsEnabled] INT,
    [TemplateAutoReply] TEXT,
    [TemplateAutoReplyAgg] TEXT,
    [IsAutoReplyEnabled] INT,
    [Language] VARCHAR(255),
    [TemplateComeInMessage] TEXT,
    [EmailTemplateType] VARCHAR(255),
    [AggEmailTemplateType] VARCHAR(255),
    [IsSendForMinorsBirthday] INT,
    [EmailHostingTemplateNum] BIGINT,
    [MinorAge] INT,
    [TemplateFailureAutoReply] TEXT,
    [SendMultipleInvites] INT,
    [TimeSpanMultipleInvites] BIGINT,
    CONSTRAINT [PK__apptremi__8A2277B268A574B9] PRIMARY KEY CLUSTERED ([ApptReminderRuleNum])
);

-- CreateTable
CREATE TABLE [dbo].[apptremindersent] (
    [ApptReminderSentNum] BIGINT NOT NULL,
    [ApptNum] BIGINT,
    [ApptDateTime] DATETIME2,
    [DateTimeSent] DATETIME2,
    [TSPrior] BIGINT,
    [ApptReminderRuleNum] BIGINT,
    [PatNum] BIGINT,
    [ClinicNum] BIGINT,
    [SendStatus] INT,
    [MessageType] INT,
    [MessageFk] BIGINT,
    [DateTimeEntry] DATETIME2,
    [ResponseDescript] TEXT,
    CONSTRAINT [PK__apptremi__EAB98E9ACF37CFBE] PRIMARY KEY CLUSTERED ([ApptReminderSentNum])
);

-- CreateTable
CREATE TABLE [dbo].[apptthankyousent] (
    [ApptThankYouSentNum] BIGINT NOT NULL,
    [ApptNum] BIGINT,
    [ApptDateTime] DATETIME2,
    [ApptSecDateTEntry] DATETIME2,
    [TSPrior] BIGINT,
    [ApptReminderRuleNum] BIGINT,
    [ClinicNum] BIGINT,
    [PatNum] BIGINT,
    [ResponseDescript] TEXT,
    [DateTimeThankYouTransmit] DATETIME2,
    [ShortGUID] VARCHAR(255),
    [SendStatus] INT,
    [DoNotResend] INT,
    [MessageType] INT,
    [MessageFk] BIGINT,
    [DateTimeEntry] DATETIME2,
    [DateTimeSent] DATETIME2,
    CONSTRAINT [PK__apptthan__57B91B2036ACCADF] PRIMARY KEY CLUSTERED ([ApptThankYouSentNum])
);

-- CreateTable
CREATE TABLE [dbo].[apptview] (
    [ApptViewNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ItemOrder] SMALLINT,
    [RowsPerIncr] INT,
    [OnlyScheduledProvs] INT,
    [OnlySchedBeforeTime] TIME,
    [OnlySchedAfterTime] TIME,
    [StackBehavUR] INT,
    [StackBehavLR] INT,
    [ClinicNum] BIGINT,
    [ApptTimeScrollStart] TIME,
    [IsScrollStartDynamic] INT,
    [IsApptBubblesDisabled] INT,
    [WidthOpMinimum] SMALLINT,
    [WaitingRmName] INT,
    [OnlyScheduledProvDays] INT,
    [ShowMirroredAppts] INT,
    CONSTRAINT [PK__apptview__D54CB781389DED3B] PRIMARY KEY CLUSTERED ([ApptViewNum])
);

-- CreateTable
CREATE TABLE [dbo].[apptviewitem] (
    [ApptViewItemNum] BIGINT NOT NULL,
    [ApptViewNum] BIGINT,
    [OpNum] BIGINT,
    [ProvNum] BIGINT,
    [ElementDesc] VARCHAR(255),
    [ElementOrder] INT,
    [ElementColor] INT,
    [ElementAlignment] INT,
    [ApptFieldDefNum] BIGINT,
    [PatFieldDefNum] BIGINT,
    [IsMobile] INT,
    CONSTRAINT [PK__apptview__E5C422C0651F4015] PRIMARY KEY CLUSTERED ([ApptViewItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[asapcomm] (
    [AsapCommNum] BIGINT NOT NULL,
    [FKey] BIGINT,
    [FKeyType] INT,
    [ScheduleNum] BIGINT,
    [PatNum] BIGINT,
    [ClinicNum] BIGINT,
    [ShortGUID] VARCHAR(255),
    [DateTimeEntry] DATETIME2,
    [DateTimeExpire] DATETIME2,
    [DateTimeSmsScheduled] DATETIME2,
    [SmsSendStatus] INT,
    [EmailSendStatus] INT,
    [DateTimeSmsSent] DATETIME2,
    [DateTimeEmailSent] DATETIME2,
    [EmailMessageNum] BIGINT,
    [ResponseStatus] INT,
    [DateTimeOrig] DATETIME2,
    [TemplateText] TEXT,
    [TemplateEmail] TEXT,
    [TemplateEmailSubj] VARCHAR(100),
    [Note] TEXT,
    [GuidMessageToMobile] VARCHAR(255),
    [EmailTemplateType] VARCHAR(255),
    [UserNum] BIGINT,
    CONSTRAINT [PK__asapcomm__A3A3A863062A61DB] PRIMARY KEY CLUSTERED ([AsapCommNum])
);

-- CreateTable
CREATE TABLE [dbo].[autocode] (
    [AutoCodeNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [IsHidden] INT,
    [LessIntrusive] INT,
    CONSTRAINT [PK__autocode__A9B32D62F324187D] PRIMARY KEY CLUSTERED ([AutoCodeNum])
);

-- CreateTable
CREATE TABLE [dbo].[autocodecond] (
    [AutoCodeCondNum] BIGINT NOT NULL,
    [AutoCodeItemNum] BIGINT,
    [Cond] INT,
    CONSTRAINT [PK__autocode__A722420FAE40268B] PRIMARY KEY CLUSTERED ([AutoCodeCondNum])
);

-- CreateTable
CREATE TABLE [dbo].[autocodeitem] (
    [AutoCodeItemNum] BIGINT NOT NULL,
    [AutoCodeNum] BIGINT,
    [OldCode] VARCHAR(15),
    [CodeNum] BIGINT,
    CONSTRAINT [PK__autocode__C6683912F60B5597] PRIMARY KEY CLUSTERED ([AutoCodeItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[autocommexcludedate] (
    [AutoCommExcludeDateNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [DateExclude] DATETIME2,
    CONSTRAINT [PK__autocomm__15368F24B396C42D] PRIMARY KEY CLUSTERED ([AutoCommExcludeDateNum])
);

-- CreateTable
CREATE TABLE [dbo].[automation] (
    [AutomationNum] BIGINT NOT NULL,
    [Description] TEXT,
    [Autotrigger] INT,
    [ProcCodes] TEXT,
    [AutoAction] INT,
    [SheetDefNum] BIGINT,
    [CommType] BIGINT,
    [MessageContent] TEXT,
    [AptStatus] INT,
    [AppointmentTypeNum] BIGINT,
    [PatStatus] INT,
    CONSTRAINT [PK__automati__B8CF3374122D529B] PRIMARY KEY CLUSTERED ([AutomationNum])
);

-- CreateTable
CREATE TABLE [dbo].[automationcondition] (
    [AutomationConditionNum] BIGINT NOT NULL,
    [AutomationNum] BIGINT,
    [CompareField] INT,
    [Comparison] INT,
    [CompareString] VARCHAR(255),
    CONSTRAINT [PK__automati__EB0D169FB6EEBF00] PRIMARY KEY CLUSTERED ([AutomationConditionNum])
);

-- CreateTable
CREATE TABLE [dbo].[autonote] (
    [AutoNoteNum] BIGINT NOT NULL,
    [AutoNoteName] VARCHAR(50),
    [MainText] TEXT,
    [Category] BIGINT,
    CONSTRAINT [PK__autonote__544ED04F12FA4B93] PRIMARY KEY CLUSTERED ([AutoNoteNum])
);

-- CreateTable
CREATE TABLE [dbo].[autonotecontrol] (
    [AutoNoteControlNum] BIGINT NOT NULL,
    [Descript] VARCHAR(50),
    [ControlType] VARCHAR(50),
    [ControlLabel] VARCHAR(255),
    [ControlOptions] TEXT,
    CONSTRAINT [PK__autonote__F83EED6ADA35E156] PRIMARY KEY CLUSTERED ([AutoNoteControlNum])
);

-- CreateTable
CREATE TABLE [dbo].[benefit] (
    [BenefitNum] BIGINT NOT NULL,
    [PlanNum] BIGINT,
    [PatPlanNum] BIGINT,
    [CovCatNum] BIGINT,
    [BenefitType] INT,
    [Percent] INT,
    [MonetaryAmt] FLOAT(53),
    [TimePeriod] INT,
    [QuantityQualifier] INT,
    [Quantity] INT,
    [CodeNum] BIGINT,
    [CoverageLevel] INT,
    [SecDateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    [CodeGroupNum] BIGINT,
    [TreatArea] INT,
    [ToothRange] VARCHAR(255),
    CONSTRAINT [PK__benefit__F08FA07FB07A71DA] PRIMARY KEY CLUSTERED ([BenefitNum])
);

-- CreateTable
CREATE TABLE [dbo].[branding] (
    [BrandingNum] BIGINT NOT NULL,
    [BrandingType] INT,
    [ClinicNum] BIGINT,
    [ValueString] TEXT,
    [DateTimeUpdated] DATETIME2,
    CONSTRAINT [PK__branding__E9B13752E6F95E6B] PRIMARY KEY CLUSTERED ([BrandingNum])
);

-- CreateTable
CREATE TABLE [dbo].[canadiannetwork] (
    [CanadianNetworkNum] BIGINT NOT NULL,
    [Abbrev] VARCHAR(20),
    [Descript] VARCHAR(255),
    [CanadianTransactionPrefix] VARCHAR(255),
    [CanadianIsRprHandler] INT,
    CONSTRAINT [PK__canadian__FCF3DF84A64CE854] PRIMARY KEY CLUSTERED ([CanadianNetworkNum])
);

-- CreateTable
CREATE TABLE [dbo].[carecreditwebresponse] (
    [CareCreditWebResponseNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [PayNum] BIGINT,
    [RefNumber] VARCHAR(255),
    [Amount] FLOAT(53),
    [WebToken] VARCHAR(255),
    [ProcessingStatus] VARCHAR(255),
    [DateTimeEntry] DATETIME2,
    [DateTimePending] DATETIME2,
    [DateTimeCompleted] DATETIME2,
    [DateTimeExpired] DATETIME2,
    [DateTimeLastError] DATETIME2,
    [LastResponseStr] TEXT,
    [ClinicNum] BIGINT,
    [ServiceType] VARCHAR(255),
    [TransType] VARCHAR(255),
    [MerchantNumber] VARCHAR(20),
    [HasLogged] INT,
    CONSTRAINT [PK__carecred__8D4C659DD1B4E7AD] PRIMARY KEY CLUSTERED ([CareCreditWebResponseNum])
);

-- CreateTable
CREATE TABLE [dbo].[carrier] (
    [CarrierNum] BIGINT NOT NULL,
    [CarrierName] VARCHAR(255),
    [Address] VARCHAR(255),
    [Address2] VARCHAR(255),
    [City] VARCHAR(255),
    [State] VARCHAR(255),
    [Zip] VARCHAR(255),
    [Phone] VARCHAR(255),
    [ElectID] VARCHAR(255),
    [NoSendElect] INT,
    [IsCDA] INT,
    [CDAnetVersion] VARCHAR(100),
    [CanadianNetworkNum] BIGINT,
    [IsHidden] INT,
    [CanadianEncryptionMethod] INT,
    [CanadianSupportedTypes] INT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    [TIN] VARCHAR(255),
    [CarrierGroupName] BIGINT,
    [ApptTextBackColor] INT,
    [IsCoinsuranceInverted] INT,
    [TrustedEtransFlags] INT,
    [CobInsPaidBehaviorOverride] INT,
    [EraAutomationOverride] INT,
    [OrthoInsPayConsolidate] INT,
    [PaySuiteTransSup] INT,
    CONSTRAINT [PK__carrier__722F4E64A23D53B6] PRIMARY KEY CLUSTERED ([CarrierNum]),
    CONSTRAINT [UQ__carrier__6D6C6564E9073C1F] UNIQUE NONCLUSTERED ([ElectID])
);

-- CreateTable
CREATE TABLE [dbo].[cdcrec] (
    [CdcrecNum] BIGINT NOT NULL,
    [CdcrecCode] VARCHAR(255),
    [HeirarchicalCode] VARCHAR(255),
    [Description] VARCHAR(255),
    CONSTRAINT [PK__cdcrec__73AFABA22B40A30E] PRIMARY KEY CLUSTERED ([CdcrecNum]),
    CONSTRAINT [UQ__cdcrec__3C1E2C81ADC6FD2E] UNIQUE NONCLUSTERED ([CdcrecCode])
);

-- CreateTable
CREATE TABLE [dbo].[cdspermission] (
    [CDSPermissionNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [SetupCDS] INT,
    [ShowCDS] INT,
    [ShowInfobutton] INT,
    [EditBibliography] INT,
    [ProblemCDS] INT,
    [MedicationCDS] INT,
    [AllergyCDS] INT,
    [DemographicCDS] INT,
    [LabTestCDS] INT,
    [VitalCDS] INT,
    CONSTRAINT [PK__cdspermi__BFACE3F5705D56B5] PRIMARY KEY CLUSTERED ([CDSPermissionNum])
);

-- CreateTable
CREATE TABLE [dbo].[centralconnection] (
    [CentralConnectionNum] BIGINT NOT NULL,
    [ServerName] VARCHAR(255),
    [DatabaseName] VARCHAR(255),
    [MySqlUser] VARCHAR(255),
    [MySqlPassword] VARCHAR(255),
    [ServiceURI] VARCHAR(255),
    [OdUser] VARCHAR(255),
    [OdPassword] VARCHAR(255),
    [Note] TEXT,
    [ItemOrder] INT,
    [WebServiceIsEcw] INT,
    [ConnectionStatus] VARCHAR(255),
    [HasClinicBreakdownReports] INT,
    CONSTRAINT [PK__centralc__33CD64F38B049A7E] PRIMARY KEY CLUSTERED ([CentralConnectionNum])
);

-- CreateTable
CREATE TABLE [dbo].[cert] (
    [CertNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [WikiPageLink] VARCHAR(255),
    [ItemOrder] INT,
    [IsHidden] INT,
    [CertCategoryNum] BIGINT,
    CONSTRAINT [PK__cert__3A7B63EB5C313437] PRIMARY KEY CLUSTERED ([CertNum])
);

-- CreateTable
CREATE TABLE [dbo].[certemployee] (
    [CertEmployeeNum] BIGINT NOT NULL,
    [CertNum] BIGINT,
    [EmployeeNum] BIGINT,
    [DateCompleted] DATE,
    [Note] VARCHAR(255),
    [UserNum] BIGINT,
    CONSTRAINT [PK__certempl__42DA40DA9EFF22BA] PRIMARY KEY CLUSTERED ([CertEmployeeNum])
);

-- CreateTable
CREATE TABLE [dbo].[chartview] (
    [ChartViewNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ItemOrder] INT,
    [ProcStatuses] INT,
    [ObjectTypes] SMALLINT,
    [ShowProcNotes] INT,
    [IsAudit] INT,
    [SelectedTeethOnly] INT,
    [OrionStatusFlags] INT,
    [DatesShowing] INT,
    [IsTpCharting] INT,
    CONSTRAINT [PK__chartvie__D0F993B3CE105A1A] PRIMARY KEY CLUSTERED ([ChartViewNum])
);

-- CreateTable
CREATE TABLE [dbo].[chat] (
    [ChatNum] BIGINT NOT NULL,
    [Name] VARCHAR(255),
    CONSTRAINT [PK__chat__EBA879F8505328B0] PRIMARY KEY CLUSTERED ([ChatNum])
);

-- CreateTable
CREATE TABLE [dbo].[chatattach] (
    [ChatAttachNum] BIGINT NOT NULL,
    [ChatMsgNum] BIGINT,
    [FileName] VARCHAR(255),
    [Thumbnail] VARBINARY(max),
    [FileData] VARBINARY(max),
    CONSTRAINT [PK__chatatta__2C00C5BF77E61D3B] PRIMARY KEY CLUSTERED ([ChatAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[chatmsg] (
    [ChatMsgNum] BIGINT NOT NULL,
    [ChatNum] BIGINT,
    [UserNum] BIGINT,
    [DateTimeSent] DATETIME2,
    [Message] TEXT,
    [SeqCount] BIGINT,
    [Quote] BIGINT,
    [EventType] INT,
    [IsImportant] INT,
    CONSTRAINT [PK__chatmsg__9FCC88A45DDF7FC0] PRIMARY KEY CLUSTERED ([ChatMsgNum])
);

-- CreateTable
CREATE TABLE [dbo].[chatreaction] (
    [ChatReactionNum] BIGINT NOT NULL,
    [ChatMsgNum] BIGINT,
    [UserNum] BIGINT,
    [EmojiName] VARCHAR(255),
    CONSTRAINT [PK__chatreac__BDBD77C8F4103710] PRIMARY KEY CLUSTERED ([ChatReactionNum])
);

-- CreateTable
CREATE TABLE [dbo].[chatuserattach] (
    [ChatUserAttachNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [ChatNum] BIGINT,
    [IsRead] INT,
    [DateTimeRemoved] DATETIME2,
    [IsMute] INT,
    CONSTRAINT [PK__chatuser__8E772F6ECC6E678D] PRIMARY KEY CLUSTERED ([ChatUserAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[chatuserod] (
    [ChatUserodNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [UserStatus] INT,
    [DateTimeStatusReset] DATETIME2,
    [Photo] TEXT,
    [PhotoCrop] VARCHAR(255),
    [OpenBackground] INT,
    [CloseKeepRunning] INT,
    [MuteNotifications] INT,
    [DismissNotifySecs] INT,
    [MuteImportantNotifications] INT,
    [DismissImportantNotifySecs] INT,
    CONSTRAINT [PK__chatuser__B364068FCC824A0E] PRIMARY KEY CLUSTERED ([ChatUserodNum])
);

-- CreateTable
CREATE TABLE [dbo].[claim] (
    [ClaimNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateService] DATE,
    [DateSent] DATE,
    [ClaimStatus] CHAR(1),
    [DateReceived] DATE,
    [PlanNum] BIGINT,
    [ProvTreat] BIGINT,
    [ClaimFee] FLOAT(53),
    [InsPayEst] FLOAT(53),
    [InsPayAmt] FLOAT(53),
    [DedApplied] FLOAT(53),
    [PreAuthString] VARCHAR(40),
    [IsProsthesis] CHAR(1),
    [PriorDate] DATE,
    [ReasonUnderPaid] VARCHAR(255),
    [ClaimNote] VARCHAR(400),
    [ClaimType] VARCHAR(255),
    [ProvBill] BIGINT,
    [ReferringProv] BIGINT,
    [RefNumString] VARCHAR(40),
    [PlaceService] INT,
    [AccidentRelated] CHAR(1),
    [AccidentDate] DATE,
    [AccidentST] VARCHAR(2),
    [EmployRelated] INT,
    [IsOrtho] INT,
    [OrthoRemainM] INT,
    [OrthoDate] DATE,
    [PatRelat] INT,
    [PlanNum2] BIGINT,
    [PatRelat2] INT,
    [WriteOff] FLOAT(53),
    [Radiographs] INT,
    [ClinicNum] BIGINT,
    [ClaimForm] BIGINT,
    [AttachedImages] INT,
    [AttachedModels] INT,
    [AttachedFlags] VARCHAR(255),
    [AttachmentID] VARCHAR(255),
    [CanadianMaterialsForwarded] VARCHAR(10),
    [CanadianReferralProviderNum] VARCHAR(20),
    [CanadianReferralReason] INT,
    [CanadianIsInitialLower] VARCHAR(5),
    [CanadianDateInitialLower] DATE,
    [CanadianMandProsthMaterial] INT,
    [CanadianIsInitialUpper] VARCHAR(5),
    [CanadianDateInitialUpper] DATE,
    [CanadianMaxProsthMaterial] INT,
    [InsSubNum] BIGINT,
    [InsSubNum2] BIGINT,
    [CanadaTransRefNum] VARCHAR(255),
    [CanadaEstTreatStartDate] DATE,
    [CanadaInitialPayment] FLOAT(53),
    [CanadaPaymentMode] INT,
    [CanadaTreatDuration] INT,
    [CanadaNumAnticipatedPayments] INT,
    [CanadaAnticipatedPayAmount] FLOAT(53),
    [PriorAuthorizationNumber] VARCHAR(255),
    [SpecialProgramCode] INT,
    [UniformBillType] VARCHAR(255),
    [MedType] INT,
    [AdmissionTypeCode] VARCHAR(255),
    [AdmissionSourceCode] VARCHAR(255),
    [PatientStatusCode] VARCHAR(255),
    [CustomTracking] BIGINT,
    [DateResent] DATE,
    [CorrectionType] INT,
    [ClaimIdentifier] VARCHAR(255),
    [OrigRefNum] VARCHAR(255),
    [ProvOrderOverride] BIGINT,
    [OrthoTotalM] INT,
    [ShareOfCost] FLOAT(53),
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    [OrderingReferralNum] BIGINT,
    [DateSentOrig] DATE,
    [DateIllnessInjuryPreg] DATE,
    [DateIllnessInjuryPregQualifier] SMALLINT,
    [DateOther] DATE,
    [DateOtherQualifier] SMALLINT,
    [IsOutsideLab] INT,
    [SecurityHash] VARCHAR(255),
    [Narrative] TEXT,
    CONSTRAINT [PK__claim__7A4522DE0BDE528F] PRIMARY KEY CLUSTERED ([ClaimNum])
);

-- CreateTable
CREATE TABLE [dbo].[claimattach] (
    [ClaimAttachNum] BIGINT NOT NULL,
    [ClaimNum] BIGINT,
    [DisplayedFileName] VARCHAR(255),
    [ActualFileName] VARCHAR(255),
    [ImageReferenceId] INT,
    CONSTRAINT [PK__claimatt__A82FF3005AA5F16D] PRIMARY KEY CLUSTERED ([ClaimAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[claimcondcodelog] (
    [ClaimCondCodeLogNum] BIGINT NOT NULL,
    [ClaimNum] BIGINT,
    [Code0] VARCHAR(2),
    [Code1] VARCHAR(2),
    [Code2] VARCHAR(2),
    [Code3] VARCHAR(2),
    [Code4] VARCHAR(2),
    [Code5] VARCHAR(2),
    [Code6] VARCHAR(2),
    [Code7] VARCHAR(2),
    [Code8] VARCHAR(2),
    [Code9] VARCHAR(2),
    [Code10] VARCHAR(2),
    CONSTRAINT [PK__claimcon__2945C47B551D8970] PRIMARY KEY CLUSTERED ([ClaimCondCodeLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[claimform] (
    [ClaimFormNum] BIGINT NOT NULL,
    [Description] VARCHAR(50),
    [IsHidden] INT,
    [FontName] VARCHAR(255),
    [FontSize] FLOAT(53),
    [UniqueID] VARCHAR(255),
    [PrintImages] INT,
    [OffsetX] SMALLINT,
    [OffsetY] SMALLINT,
    [Width] INT,
    [Height] INT,
    CONSTRAINT [PK__claimfor__995450E92A0B1FBC] PRIMARY KEY CLUSTERED ([ClaimFormNum])
);

-- CreateTable
CREATE TABLE [dbo].[claimformitem] (
    [ClaimFormItemNum] BIGINT NOT NULL,
    [ClaimFormNum] BIGINT,
    [ImageFileName] VARCHAR(255),
    [FieldName] VARCHAR(255),
    [FormatString] VARCHAR(255),
    [XPos] FLOAT(53),
    [YPos] FLOAT(53),
    [Width] FLOAT(53),
    [Height] FLOAT(53),
    CONSTRAINT [PK__claimfor__421BFB7ADFE03C50] PRIMARY KEY CLUSTERED ([ClaimFormItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[claimpayment] (
    [ClaimPaymentNum] BIGINT NOT NULL,
    [CheckDate] DATE,
    [CheckAmt] FLOAT(53),
    [CheckNum] VARCHAR(25),
    [BankBranch] VARCHAR(25),
    [Note] VARCHAR(255),
    [ClinicNum] BIGINT,
    [DepositNum] BIGINT,
    [CarrierName] VARCHAR(255),
    [DateIssued] DATE,
    [IsPartial] INT,
    [PayType] BIGINT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    [PayGroup] BIGINT,
    CONSTRAINT [PK__claimpay__D37EE970ADCDF7B3] PRIMARY KEY CLUSTERED ([ClaimPaymentNum])
);

-- CreateTable
CREATE TABLE [dbo].[claimproc] (
    [ClaimProcNum] BIGINT NOT NULL,
    [ProcNum] BIGINT,
    [ClaimNum] BIGINT,
    [PatNum] BIGINT,
    [ProvNum] BIGINT,
    [FeeBilled] FLOAT(53),
    [InsPayEst] FLOAT(53),
    [DedApplied] FLOAT(53),
    [Status] INT,
    [InsPayAmt] FLOAT(53),
    [Remarks] VARCHAR(255),
    [ClaimPaymentNum] BIGINT,
    [PlanNum] BIGINT,
    [DateCP] DATE,
    [WriteOff] FLOAT(53),
    [CodeSent] VARCHAR(15),
    [AllowedOverride] FLOAT(53),
    [Percentage] INT,
    [PercentOverride] INT,
    [CopayAmt] FLOAT(53),
    [NoBillIns] INT,
    [PaidOtherIns] FLOAT(53),
    [BaseEst] FLOAT(53),
    [CopayOverride] FLOAT(53),
    [ProcDate] DATE,
    [DateEntry] DATE,
    [LineNumber] INT,
    [DedEst] FLOAT(53),
    [DedEstOverride] FLOAT(53),
    [InsEstTotal] FLOAT(53),
    [InsEstTotalOverride] FLOAT(53),
    [PaidOtherInsOverride] FLOAT(53),
    [EstimateNote] VARCHAR(255),
    [WriteOffEst] FLOAT(53),
    [WriteOffEstOverride] FLOAT(53),
    [ClinicNum] BIGINT,
    [InsSubNum] BIGINT,
    [PaymentRow] INT,
    [PayPlanNum] BIGINT,
    [ClaimPaymentTracking] BIGINT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    [DateSuppReceived] DATE,
    [DateInsFinalized] DATE,
    [IsTransfer] INT,
    [ClaimAdjReasonCodes] VARCHAR(255),
    [IsOverpay] INT,
    [SecurityHash] VARCHAR(255),
    CONSTRAINT [PK__claimpro__AA928B12450901B2] PRIMARY KEY CLUSTERED ([ClaimProcNum])
);

-- CreateTable
CREATE TABLE [dbo].[claimsnapshot] (
    [ClaimSnapshotNum] BIGINT NOT NULL,
    [ProcNum] BIGINT,
    [ClaimType] VARCHAR(255),
    [Writeoff] FLOAT(53),
    [InsPayEst] FLOAT(53),
    [Fee] FLOAT(53),
    [DateTEntry] DATETIME2,
    [ClaimProcNum] BIGINT,
    [SnapshotTrigger] INT,
    CONSTRAINT [PK__claimsna__A854E0252E791C76] PRIMARY KEY CLUSTERED ([ClaimSnapshotNum])
);

-- CreateTable
CREATE TABLE [dbo].[claimtracking] (
    [ClaimTrackingNum] BIGINT NOT NULL,
    [ClaimNum] BIGINT,
    [TrackingType] VARCHAR(255),
    [UserNum] BIGINT,
    [DateTimeEntry] DATETIME2,
    [Note] TEXT,
    [TrackingDefNum] BIGINT,
    [TrackingErrorDefNum] BIGINT,
    CONSTRAINT [PK__claimtra__F75BEA03B08218D5] PRIMARY KEY CLUSTERED ([ClaimTrackingNum])
);

-- CreateTable
CREATE TABLE [dbo].[claimvalcodelog] (
    [ClaimValCodeLogNum] BIGINT NOT NULL,
    [ClaimNum] BIGINT,
    [ClaimField] VARCHAR(5),
    [ValCode] CHAR(2),
    [ValAmount] FLOAT(53),
    [Ordinal] INT,
    CONSTRAINT [PK__claimval__2331A6B617B13EA6] PRIMARY KEY CLUSTERED ([ClaimValCodeLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[clearinghouse] (
    [ClearinghouseNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ExportPath] TEXT,
    [Payors] TEXT,
    [Eformat] INT,
    [ISA05] VARCHAR(255),
    [SenderTIN] VARCHAR(255),
    [ISA07] VARCHAR(255),
    [ISA08] VARCHAR(255),
    [ISA15] VARCHAR(255),
    [Password] VARCHAR(255),
    [ResponsePath] VARCHAR(255),
    [CommBridge] INT,
    [ClientProgram] VARCHAR(255),
    [LastBatchNumber] SMALLINT,
    [ModemPort] INT,
    [LoginID] VARCHAR(255),
    [SenderName] VARCHAR(255),
    [SenderTelephone] VARCHAR(255),
    [GS03] VARCHAR(255),
    [ISA02] VARCHAR(10),
    [ISA04] VARCHAR(10),
    [ISA16] VARCHAR(2),
    [SeparatorData] VARCHAR(2),
    [SeparatorSegment] VARCHAR(2),
    [ClinicNum] BIGINT,
    [HqClearinghouseNum] BIGINT,
    [IsEraDownloadAllowed] INT,
    [IsClaimExportAllowed] INT,
    [IsAttachmentSendAllowed] INT,
    [LocationID] VARCHAR(255),
    [EnableXConnect] INT,
    CONSTRAINT [PK__clearing__AC98FCC3AD2B011F] PRIMARY KEY CLUSTERED ([ClearinghouseNum])
);

-- CreateTable
CREATE TABLE [dbo].[clinic] (
    [ClinicNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [Address] VARCHAR(255),
    [Address2] VARCHAR(255),
    [City] VARCHAR(255),
    [State] VARCHAR(255),
    [Zip] VARCHAR(255),
    [Phone] VARCHAR(255),
    [BankNumber] VARCHAR(255),
    [DefaultPlaceService] INT,
    [InsBillingProv] BIGINT,
    [Fax] VARCHAR(50),
    [EmailAddressNum] BIGINT,
    [DefaultProv] BIGINT,
    [SmsContractDate] DATETIME2,
    [SmsMonthlyLimit] FLOAT(53),
    [IsMedicalOnly] INT,
    [BillingAddress] VARCHAR(255),
    [BillingAddress2] VARCHAR(255),
    [BillingCity] VARCHAR(255),
    [BillingState] VARCHAR(255),
    [BillingZip] VARCHAR(255),
    [PayToAddress] VARCHAR(255),
    [PayToAddress2] VARCHAR(255),
    [PayToCity] VARCHAR(255),
    [PayToState] VARCHAR(255),
    [PayToZip] VARCHAR(255),
    [UseBillAddrOnClaims] INT,
    [Region] BIGINT,
    [ItemOrder] INT,
    [IsInsVerifyExcluded] INT,
    [Abbr] VARCHAR(255),
    [MedLabAccountNum] VARCHAR(255),
    [IsConfirmEnabled] INT,
    [IsConfirmDefault] INT,
    [IsNewPatApptExcluded] INT,
    [IsHidden] INT,
    [ExternalID] BIGINT,
    [SchedNote] VARCHAR(255),
    [HasProcOnRx] INT,
    [TimeZone] VARCHAR(75),
    [EmailAliasOverride] VARCHAR(255),
    CONSTRAINT [PK__clinic__AE228314D2A96BE3] PRIMARY KEY CLUSTERED ([ClinicNum])
);

-- CreateTable
CREATE TABLE [dbo].[clinicerx] (
    [ClinicErxNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ClinicDesc] VARCHAR(255),
    [ClinicNum] BIGINT,
    [EnabledStatus] INT,
    [ClinicId] VARCHAR(255),
    [ClinicKey] VARCHAR(255),
    [AccountId] VARCHAR(25),
    [RegistrationKeyNum] BIGINT,
    CONSTRAINT [PK__clinicer__298CD4002D545515] PRIMARY KEY CLUSTERED ([ClinicErxNum])
);

-- CreateTable
CREATE TABLE [dbo].[clinicpref] (
    [ClinicPrefNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [PrefName] VARCHAR(255),
    [ValueString] TEXT,
    CONSTRAINT [PK__clinicpr__35D23AD5EAAAE4B5] PRIMARY KEY CLUSTERED ([ClinicPrefNum])
);

-- CreateTable
CREATE TABLE [dbo].[clockevent] (
    [ClockEventNum] BIGINT NOT NULL,
    [EmployeeNum] BIGINT,
    [TimeEntered1] DATETIME2,
    [TimeDisplayed1] DATETIME2,
    [ClockStatus] INT,
    [Note] TEXT,
    [TimeEntered2] DATETIME2,
    [TimeDisplayed2] DATETIME2,
    [OTimeHours] TIME,
    [OTimeAuto] TIME,
    [Adjust] TIME,
    [AdjustAuto] TIME,
    [AdjustIsOverridden] INT,
    [Rate2Hours] TIME,
    [Rate2Auto] TIME,
    [ClinicNum] BIGINT,
    [Rate3Hours] TIME,
    [Rate3Auto] TIME,
    [IsWorkingHome] INT,
    CONSTRAINT [PK__clockeve__BA485FF85020EFCF] PRIMARY KEY CLUSTERED ([ClockEventNum])
);

-- CreateTable
CREATE TABLE [dbo].[cloudaddress] (
    [CloudAddressNum] BIGINT NOT NULL,
    [IpAddress] VARCHAR(50),
    [UserNumLastConnect] BIGINT,
    [DateTimeLastConnect] DATETIME2,
    CONSTRAINT [PK__cloudadd__B1718832A9C2CE01] PRIMARY KEY CLUSTERED ([CloudAddressNum])
);

-- CreateTable
CREATE TABLE [dbo].[codegroup] (
    [CodeGroupNum] BIGINT NOT NULL,
    [GroupName] VARCHAR(50),
    [ProcCodes] TEXT,
    [ItemOrder] INT,
    [CodeGroupFixed] INT,
    [IsHidden] INT,
    [ShowInAgeLimit] INT,
    [ShowInFrequency] INT,
    [ShowInOther] INT,
    CONSTRAINT [PK__codegrou__CDB8770389373997] PRIMARY KEY CLUSTERED ([CodeGroupNum])
);

-- CreateTable
CREATE TABLE [dbo].[codesystem] (
    [CodeSystemNum] BIGINT NOT NULL,
    [CodeSystemName] VARCHAR(255),
    [VersionCur] VARCHAR(255),
    [VersionAvail] VARCHAR(255),
    [HL7OID] VARCHAR(255),
    [Note] VARCHAR(255),
    CONSTRAINT [PK__codesyst__4ED19569ECFDF7BF] PRIMARY KEY CLUSTERED ([CodeSystemNum]),
    CONSTRAINT [UQ__codesyst__39A83DBE68EA3481] UNIQUE NONCLUSTERED ([CodeSystemName])
);

-- CreateTable
CREATE TABLE [dbo].[commlog] (
    [CommlogNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [CommDateTime] DATETIME2,
    [CommType] BIGINT,
    [Note] TEXT,
    [Mode_] INT,
    [SentOrReceived] INT,
    [UserNum] BIGINT,
    [Signature] TEXT,
    [SigIsTopaz] INT,
    [DateTStamp] DATETIME2,
    [DateTimeEnd] DATETIME2,
    [CommSource] INT,
    [ProgramNum] BIGINT,
    [DateTEntry] DATETIME2,
    [ReferralNum] BIGINT,
    [CommReferralBehavior] INT,
    CONSTRAINT [PK__commlog__F3A1935084CF3243] PRIMARY KEY CLUSTERED ([CommlogNum])
);

-- CreateTable
CREATE TABLE [dbo].[commoptout] (
    [CommOptOutNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [OptOutSms] INT,
    [OptOutEmail] INT,
    CONSTRAINT [PK__commopto__17460CC881E66C54] PRIMARY KEY CLUSTERED ([CommOptOutNum])
);

-- CreateTable
CREATE TABLE [dbo].[computer] (
    [ComputerNum] BIGINT NOT NULL,
    [CompName] VARCHAR(100),
    [LastHeartBeat] DATETIME2,
    CONSTRAINT [PK__computer__5C64ADF75779CB4F] PRIMARY KEY CLUSTERED ([ComputerNum])
);

-- CreateTable
CREATE TABLE [dbo].[computerpref] (
    [ComputerPrefNum] BIGINT NOT NULL,
    [ComputerName] VARCHAR(64),
    [GraphicsUseHardware] INT,
    [GraphicsSimple] INT,
    [SensorType] VARCHAR(255),
    [SensorBinned] INT,
    [SensorPort] INT,
    [SensorExposure] INT,
    [GraphicsDoubleBuffering] INT,
    [PreferredPixelFormatNum] INT,
    [AtoZpath] VARCHAR(255),
    [TaskKeepListHidden] INT,
    [TaskDock] INT,
    [TaskX] INT,
    [TaskY] INT,
    [DirectXFormat] VARCHAR(255),
    [ScanDocSelectSource] INT,
    [ScanDocShowOptions] INT,
    [ScanDocDuplex] INT,
    [ScanDocGrayscale] INT,
    [ScanDocResolution] INT,
    [ScanDocQuality] INT,
    [ClinicNum] BIGINT,
    [ApptViewNum] BIGINT,
    [RecentApptView] INT,
    [PatSelectSearchMode] INT,
    [NoShowLanguage] INT,
    [NoShowDecimal] INT,
    [ComputerOS] VARCHAR(255),
    [HelpButtonXAdjustment] FLOAT(53),
    [GraphicsUseDirectX11] INT,
    [Zoom] INT,
    [VideoRectangle] VARCHAR(255),
    [CreditCardTerminalId] VARCHAR(255),
    CONSTRAINT [PK__computer__53593293F0D55D7F] PRIMARY KEY CLUSTERED ([ComputerPrefNum])
);

-- CreateTable
CREATE TABLE [dbo].[confirmationrequest] (
    [ConfirmationRequestNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [PatNum] BIGINT,
    [ApptNum] BIGINT,
    [DateTimeConfirmExpire] DATETIME2,
    [ShortGUID] VARCHAR(255),
    [ConfirmCode] VARCHAR(255),
    [DateTimeEntry] DATETIME2,
    [DateTimeConfirmTransmit] DATETIME2,
    [DateTimeRSVP] DATETIME2,
    [RSVPStatus] INT,
    [ResponseDescript] TEXT,
    [GuidMessageFromMobile] VARCHAR(255),
    [ApptDateTime] DATETIME2,
    [TSPrior] BIGINT,
    [DoNotResend] INT,
    [SendStatus] INT,
    [ApptReminderRuleNum] BIGINT,
    [MessageType] INT,
    [MessageFk] BIGINT,
    [DateTimeSent] DATETIME2,
    CONSTRAINT [PK__confirma__1AE1C17504883E25] PRIMARY KEY CLUSTERED ([ConfirmationRequestNum]),
    CONSTRAINT [UQ__confirma__B87A08EB90C9A538] UNIQUE NONCLUSTERED ([GuidMessageFromMobile])
);

-- CreateTable
CREATE TABLE [dbo].[connectiongroup] (
    [ConnectionGroupNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    CONSTRAINT [PK__connecti__01D1CA209AD26F1A] PRIMARY KEY CLUSTERED ([ConnectionGroupNum])
);

-- CreateTable
CREATE TABLE [dbo].[conngroupattach] (
    [ConnGroupAttachNum] BIGINT,
    [ConnectionGroupNum] BIGINT,
    [CentralConnectionNum] BIGINT
);

-- CreateTable
CREATE TABLE [dbo].[contact] (
    [ContactNum] BIGINT NOT NULL,
    [LName] VARCHAR(255),
    [FName] VARCHAR(255),
    [WkPhone] VARCHAR(255),
    [Fax] VARCHAR(255),
    [Category] BIGINT,
    [Notes] TEXT,
    CONSTRAINT [PK__contact__8BAFE55EB0632E69] PRIMARY KEY CLUSTERED ([ContactNum])
);

-- CreateTable
CREATE TABLE [dbo].[county] (
    [CountyNum] BIGINT NOT NULL,
    [CountyName] VARCHAR(255),
    [CountyCode] VARCHAR(255),
    CONSTRAINT [PK__county__C249D49360D64B88] PRIMARY KEY CLUSTERED ([CountyNum]),
    CONSTRAINT [UQ__county__F3C40510756EF971] UNIQUE NONCLUSTERED ([CountyName])
);

-- CreateTable
CREATE TABLE [dbo].[covcat] (
    [CovCatNum] BIGINT NOT NULL,
    [Description] VARCHAR(50),
    [DefaultPercent] SMALLINT,
    [CovOrder] INT,
    [IsHidden] INT,
    [EbenefitCat] INT,
    CONSTRAINT [PK__covcat__5667C1C30CDEF9A4] PRIMARY KEY CLUSTERED ([CovCatNum])
);

-- CreateTable
CREATE TABLE [dbo].[covspan] (
    [CovSpanNum] BIGINT NOT NULL,
    [CovCatNum] BIGINT,
    [FromCode] VARCHAR(15),
    [ToCode] VARCHAR(15),
    CONSTRAINT [PK__covspan__36EBCB7AE6F0852F] PRIMARY KEY CLUSTERED ([CovSpanNum])
);

-- CreateTable
CREATE TABLE [dbo].[cpt] (
    [CptNum] BIGINT NOT NULL,
    [CptCode] VARCHAR(255),
    [Description] VARCHAR(4000),
    [VersionIDs] VARCHAR(255),
    CONSTRAINT [PK__cpt__5FFC3AC5993EF072] PRIMARY KEY CLUSTERED ([CptNum])
);

-- CreateTable
CREATE TABLE [dbo].[creditcard] (
    [CreditCardNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [Address] VARCHAR(255),
    [Zip] VARCHAR(255),
    [XChargeToken] VARCHAR(255),
    [CCNumberMasked] VARCHAR(255),
    [CCExpiration] DATE,
    [ItemOrder] INT,
    [ChargeAmt] FLOAT(53),
    [DateStart] DATE,
    [DateStop] DATE,
    [Note] VARCHAR(255),
    [PayPlanNum] BIGINT,
    [PayConnectToken] VARCHAR(255),
    [PayConnectTokenExp] DATE,
    [Procedures] TEXT,
    [CCSource] INT,
    [ClinicNum] BIGINT,
    [ExcludeProcSync] INT,
    [PaySimpleToken] VARCHAR(255),
    [ChargeFrequency] VARCHAR(150),
    [CanChargeWhenNoBal] INT,
    [PaymentType] BIGINT,
    [IsRecurringActive] INT,
    [Nickname] VARCHAR(255),
    [CardHolderName] VARCHAR(255),
    CONSTRAINT [PK__creditca__1265D6C6DF03384E] PRIMARY KEY CLUSTERED ([CreditCardNum])
);

-- CreateTable
CREATE TABLE [dbo].[custrefentry] (
    [CustRefEntryNum] BIGINT NOT NULL,
    [PatNumCust] BIGINT,
    [PatNumRef] BIGINT,
    [DateEntry] DATE,
    [Note] VARCHAR(255),
    CONSTRAINT [PK__custrefe__80EBFC67ADBB8AC6] PRIMARY KEY CLUSTERED ([CustRefEntryNum])
);

-- CreateTable
CREATE TABLE [dbo].[custreference] (
    [CustReferenceNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateMostRecent] DATE,
    [Note] VARCHAR(255),
    [IsBadRef] INT,
    CONSTRAINT [PK__custrefe__B9AF22BC8E6EF153] PRIMARY KEY CLUSTERED ([CustReferenceNum])
);

-- CreateTable
CREATE TABLE [dbo].[cvx] (
    [CvxNum] BIGINT NOT NULL,
    [CvxCode] VARCHAR(255),
    [Description] VARCHAR(255),
    [IsActive] VARCHAR(255),
    CONSTRAINT [PK__cvx__264C371EFCDDDFDB] PRIMARY KEY CLUSTERED ([CvxNum])
);

-- CreateTable
CREATE TABLE [dbo].[dashboardar] (
    [DashboardARNum] BIGINT NOT NULL,
    [DateCalc] DATE,
    [BalTotal] FLOAT(53),
    [InsEst] FLOAT(53),
    CONSTRAINT [PK__dashboar__59C4B9A38510C39B] PRIMARY KEY CLUSTERED ([DashboardARNum])
);

-- CreateTable
CREATE TABLE [dbo].[dashboardcell] (
    [DashboardCellNum] BIGINT NOT NULL,
    [DashboardLayoutNum] BIGINT,
    [CellRow] INT,
    [CellColumn] INT,
    [CellType] VARCHAR(255),
    [CellSettings] TEXT,
    [LastQueryTime] DATETIME2,
    [LastQueryData] TEXT,
    [RefreshRateSeconds] INT,
    CONSTRAINT [PK__dashboar__7E8375853D00437E] PRIMARY KEY CLUSTERED ([DashboardCellNum])
);

-- CreateTable
CREATE TABLE [dbo].[dashboardlayout] (
    [DashboardLayoutNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [UserGroupNum] BIGINT,
    [DashboardTabName] VARCHAR(255),
    [DashboardTabOrder] INT,
    [DashboardRows] INT,
    [DashboardColumns] INT,
    [DashboardGroupName] VARCHAR(255),
    CONSTRAINT [PK__dashboar__FB0DDC6522AE7B07] PRIMARY KEY CLUSTERED ([DashboardLayoutNum])
);

-- CreateTable
CREATE TABLE [dbo].[databasemaintenance] (
    [DatabaseMaintenanceNum] BIGINT NOT NULL,
    [MethodName] VARCHAR(255),
    [IsHidden] INT,
    [IsOld] INT,
    [DateLastRun] DATETIME2,
    CONSTRAINT [PK__database__CA8631F4AF32592A] PRIMARY KEY CLUSTERED ([DatabaseMaintenanceNum])
);

-- CreateTable
CREATE TABLE [dbo].[dbmlog] (
    [DbmLogNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [FKey] BIGINT,
    [FKeyType] INT,
    [ActionType] INT,
    [DateTimeEntry] DATETIME2,
    [MethodName] VARCHAR(255),
    [LogText] TEXT,
    CONSTRAINT [PK__dbmlog__573F2C7B79AA7F14] PRIMARY KEY CLUSTERED ([DbmLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[definition] (
    [DefNum] BIGINT NOT NULL,
    [Category] INT,
    [ItemOrder] SMALLINT,
    [ItemName] VARCHAR(255),
    [ItemValue] VARCHAR(255),
    [ItemColor] INT,
    [IsHidden] INT,
    CONSTRAINT [PK__definiti__B39ADA0215AA7EA2] PRIMARY KEY CLUSTERED ([DefNum])
);

-- CreateTable
CREATE TABLE [dbo].[deflink] (
    [DefLinkNum] BIGINT NOT NULL,
    [DefNum] BIGINT,
    [FKey] BIGINT,
    [LinkType] INT,
    CONSTRAINT [PK__deflink__630636D4FC50BD2D] PRIMARY KEY CLUSTERED ([DefLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[deletedobject] (
    [DeletedObjectNum] BIGINT NOT NULL,
    [ObjectNum] BIGINT,
    [ObjectType] INT,
    [DateTStamp] DATETIME2,
    CONSTRAINT [PK__deletedo__29A405A65AB70CC6] PRIMARY KEY CLUSTERED ([DeletedObjectNum])
);

-- CreateTable
CREATE TABLE [dbo].[deposit] (
    [DepositNum] BIGINT NOT NULL,
    [DateDeposit] DATE,
    [BankAccountInfo] TEXT,
    [Amount] FLOAT(53),
    [Memo] VARCHAR(255),
    [Batch] VARCHAR(25),
    [DepositAccountNum] BIGINT,
    [IsSentToQuickBooksOnline] INT,
    CONSTRAINT [PK__deposit__35D694E2AB6631BF] PRIMARY KEY CLUSTERED ([DepositNum])
);

-- CreateTable
CREATE TABLE [dbo].[dictcustom] (
    [DictCustomNum] BIGINT NOT NULL,
    [WordText] VARCHAR(255),
    CONSTRAINT [PK__dictcust__0E650D4EF1B92A39] PRIMARY KEY CLUSTERED ([DictCustomNum])
);

-- CreateTable
CREATE TABLE [dbo].[discountplan] (
    [DiscountPlanNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [FeeSchedNum] BIGINT,
    [DefNum] BIGINT,
    [IsHidden] INT,
    [PlanNote] TEXT,
    [ExamFreqLimit] INT,
    [XrayFreqLimit] INT,
    [ProphyFreqLimit] INT,
    [FluorideFreqLimit] INT,
    [PerioFreqLimit] INT,
    [LimitedExamFreqLimit] INT,
    [PAFreqLimit] INT,
    [AnnualMax] FLOAT(53),
    CONSTRAINT [PK__discount__0A2A7D31A5B746B9] PRIMARY KEY CLUSTERED ([DiscountPlanNum])
);

-- CreateTable
CREATE TABLE [dbo].[discountplansub] (
    [DiscountSubNum] BIGINT,
    [DiscountPlanNum] BIGINT,
    [PatNum] BIGINT,
    [DateEffective] DATE,
    [DateTerm] DATE,
    [SubNote] TEXT
);

-- CreateTable
CREATE TABLE [dbo].[disease] (
    [DiseaseNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DiseaseDefNum] BIGINT,
    [PatNote] TEXT,
    [DateTStamp] DATETIME2,
    [ProbStatus] INT,
    [DateStart] DATE,
    [DateStop] DATE,
    [SnomedProblemType] VARCHAR(255),
    [FunctionStatus] INT,
    CONSTRAINT [PK__disease__94C6BF80CEEC4C81] PRIMARY KEY CLUSTERED ([DiseaseNum])
);

-- CreateTable
CREATE TABLE [dbo].[diseasedef] (
    [DiseaseDefNum] BIGINT NOT NULL,
    [DiseaseName] VARCHAR(255),
    [ItemOrder] SMALLINT,
    [IsHidden] INT,
    [DateTStamp] DATETIME2,
    [ICD9Code] VARCHAR(255),
    [SnomedCode] VARCHAR(255),
    [Icd10Code] VARCHAR(255),
    CONSTRAINT [PK__diseased__85519E166C534B90] PRIMARY KEY CLUSTERED ([DiseaseDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[displayfield] (
    [DisplayFieldNum] BIGINT NOT NULL,
    [InternalName] VARCHAR(255),
    [ItemOrder] INT,
    [Description] VARCHAR(255),
    [ColumnWidth] INT,
    [Category] INT,
    [ChartViewNum] BIGINT,
    [PickList] TEXT,
    [DescriptionOverride] VARCHAR(255),
    CONSTRAINT [PK__displayf__6BEA2AF9A623D5E7] PRIMARY KEY CLUSTERED ([DisplayFieldNum])
);

-- CreateTable
CREATE TABLE [dbo].[displayreport] (
    [DisplayReportNum] BIGINT NOT NULL,
    [InternalName] VARCHAR(255),
    [ItemOrder] INT,
    [Description] VARCHAR(255),
    [Category] INT,
    [IsHidden] INT,
    [IsVisibleInSubMenu] INT,
    CONSTRAINT [PK__displayr__75C4F2270BDC8586] PRIMARY KEY CLUSTERED ([DisplayReportNum])
);

-- CreateTable
CREATE TABLE [dbo].[dispsupply] (
    [DispSupplyNum] BIGINT NOT NULL,
    [SupplyNum] BIGINT,
    [ProvNum] BIGINT,
    [DateDispensed] DATE,
    [DispQuantity] FLOAT(53),
    [Note] TEXT,
    CONSTRAINT [PK__dispsupp__62AA4C22743B7BDC] PRIMARY KEY CLUSTERED ([DispSupplyNum])
);

-- CreateTable
CREATE TABLE [dbo].[document] (
    [DocNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [DateCreated] DATETIME2,
    [DocCategory] BIGINT,
    [PatNum] BIGINT,
    [FileName] VARCHAR(255),
    [ImgType] INT,
    [IsFlipped] INT,
    [DegreesRotated] FLOAT(53),
    [ToothNumbers] VARCHAR(255),
    [Note] TEXT,
    [SigIsTopaz] INT,
    [Signature] TEXT,
    [CropX] INT,
    [CropY] INT,
    [CropW] INT,
    [CropH] INT,
    [WindowingMin] INT,
    [WindowingMax] INT,
    [MountItemNum] BIGINT,
    [DateTStamp] DATETIME2,
    [RawBase64] TEXT,
    [Thumbnail] TEXT,
    [ExternalGUID] VARCHAR(255),
    [ExternalSource] VARCHAR(255),
    [ProvNum] BIGINT,
    [IsCropOld] INT,
    [OcrResponseData] TEXT,
    [ImageCaptureType] INT,
    [PrintHeading] INT,
    [ChartLetterStatus] INT,
    [UserNum] BIGINT,
    [ChartLetterHash] VARCHAR(255),
    CONSTRAINT [PK__document__420AEAF1F816C97F] PRIMARY KEY CLUSTERED ([DocNum])
);

-- CreateTable
CREATE TABLE [dbo].[documentmisc] (
    [DocMiscNum] BIGINT NOT NULL,
    [DateCreated] DATE,
    [FileName] VARCHAR(255),
    [DocMiscType] INT,
    [RawBase64] TEXT,
    CONSTRAINT [PK__document__140C2D17D3326B70] PRIMARY KEY CLUSTERED ([DocMiscNum])
);

-- CreateTable
CREATE TABLE [dbo].[drugmanufacturer] (
    [DrugManufacturerNum] BIGINT NOT NULL,
    [ManufacturerName] VARCHAR(255),
    [ManufacturerCode] VARCHAR(20),
    CONSTRAINT [PK__drugmanu__474D11FCFFBC9F7C] PRIMARY KEY CLUSTERED ([DrugManufacturerNum])
);

-- CreateTable
CREATE TABLE [dbo].[drugunit] (
    [DrugUnitNum] BIGINT NOT NULL,
    [UnitIdentifier] VARCHAR(20),
    [UnitText] VARCHAR(255),
    CONSTRAINT [PK__drugunit__177DF95B4C452565] PRIMARY KEY CLUSTERED ([DrugUnitNum]),
    CONSTRAINT [UQ__drugunit__E8043BBFF46FCEA2] UNIQUE NONCLUSTERED ([UnitText])
);

-- CreateTable
CREATE TABLE [dbo].[dunning] (
    [DunningNum] BIGINT NOT NULL,
    [DunMessage] TEXT,
    [BillingType] BIGINT,
    [AgeAccount] INT,
    [InsIsPending] INT,
    [MessageBold] TEXT,
    [EmailSubject] VARCHAR(255),
    [EmailBody] TEXT,
    [DaysInAdvance] INT,
    [ClinicNum] BIGINT,
    [IsSuperFamily] INT,
    CONSTRAINT [PK__dunning__95382457D02E28D5] PRIMARY KEY CLUSTERED ([DunningNum])
);

-- CreateTable
CREATE TABLE [dbo].[ebill] (
    [EbillNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [ClientAcctNumber] VARCHAR(255),
    [ElectUserName] VARCHAR(255),
    [ElectPassword] VARCHAR(255),
    [PracticeAddress] INT,
    [RemitAddress] INT,
    CONSTRAINT [PK__ebill__7CD712AFE54DEAB8] PRIMARY KEY CLUSTERED ([EbillNum])
);

-- CreateTable
CREATE TABLE [dbo].[eclipboardimagecapture] (
    [EClipboardImageCaptureNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DefNum] BIGINT,
    [IsSelfPortrait] INT,
    [DateTimeUpserted] DATETIME2,
    [DocNum] BIGINT,
    [OcrCaptureType] INT,
    CONSTRAINT [PK__eclipboa__60458518764F1368] PRIMARY KEY CLUSTERED ([EClipboardImageCaptureNum])
);

-- CreateTable
CREATE TABLE [dbo].[eclipboardimagecapturedef] (
    [EClipboardImageCaptureDefNum] BIGINT NOT NULL,
    [DefNum] BIGINT,
    [IsSelfPortrait] INT,
    [FrequencyDays] INT,
    [ClinicNum] BIGINT,
    [OcrCaptureType] INT,
    [Frequency] INT,
    [ResubmitInterval] BIGINT,
    CONSTRAINT [PK__eclipboa__646D9B7BD6CB736E] PRIMARY KEY CLUSTERED ([EClipboardImageCaptureDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[eclipboardsheetdef] (
    [EClipboardSheetDefNum] BIGINT NOT NULL,
    [SheetDefNum] BIGINT,
    [ClinicNum] BIGINT,
    [ResubmitInterval] BIGINT,
    [ItemOrder] INT,
    [PrefillStatus] INT,
    [MinAge] INT,
    [MaxAge] INT,
    [IgnoreSheetDefNums] TEXT,
    [PrefillStatusOverride] BIGINT,
    [EFormDefNum] BIGINT,
    [Frequency] INT,
    [SheetDefNumsConsidered] VARCHAR(255),
    CONSTRAINT [PK__eclipboa__27367AA0B9A78D9B] PRIMARY KEY CLUSTERED ([EClipboardSheetDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[eduresource] (
    [EduResourceNum] BIGINT NOT NULL,
    [DiseaseDefNum] BIGINT,
    [MedicationNum] BIGINT,
    [LabResultID] VARCHAR(255),
    [LabResultName] VARCHAR(255),
    [LabResultCompare] VARCHAR(255),
    [ResourceUrl] VARCHAR(255),
    [SmokingSnoMed] VARCHAR(30),
    CONSTRAINT [PK__eduresou__37C79820DE1522E5] PRIMARY KEY CLUSTERED ([EduResourceNum])
);

-- CreateTable
CREATE TABLE [dbo].[eform] (
    [EFormNum] BIGINT NOT NULL,
    [FormType] INT,
    [PatNum] BIGINT,
    [DateTimeShown] DATETIME2,
    [Description] VARCHAR(255),
    [DateTEdited] DATETIME2,
    [MaxWidth] INT,
    [EFormDefNum] BIGINT,
    [Status] INT,
    [RevID] INT,
    [ShowLabelsBold] INT,
    [SpaceBelowEachField] INT,
    [SpaceToRightEachField] INT,
    [SaveImageCategory] BIGINT,
    CONSTRAINT [PK__eform__FFC4EFFCEF484298] PRIMARY KEY CLUSTERED ([EFormNum])
);

-- CreateTable
CREATE TABLE [dbo].[eformdef] (
    [EFormDefNum] BIGINT NOT NULL,
    [FormType] INT,
    [Description] VARCHAR(255),
    [DateTCreated] DATETIME2,
    [IsInternalHidden] INT,
    [MaxWidth] INT,
    [RevID] INT,
    [ShowLabelsBold] INT,
    [SpaceBelowEachField] INT,
    [SpaceToRightEachField] INT,
    [SaveImageCategory] BIGINT,
    CONSTRAINT [PK__eformdef__2F5207BAAD138C56] PRIMARY KEY CLUSTERED ([EFormDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[eformfield] (
    [EFormFieldNum] BIGINT NOT NULL,
    [EFormNum] BIGINT,
    [PatNum] BIGINT,
    [FieldType] INT,
    [DbLink] VARCHAR(255),
    [ValueLabel] TEXT,
    [ValueString] TEXT,
    [ItemOrder] INT,
    [PickListVis] TEXT,
    [PickListDb] TEXT,
    [IsHorizStacking] INT,
    [IsTextWrap] INT,
    [Width] INT,
    [FontScale] INT,
    [IsRequired] INT,
    [ConditionalParent] VARCHAR(255),
    [ConditionalValue] TEXT,
    [LabelAlign] INT,
    [SpaceBelow] INT,
    [ReportableName] VARCHAR(255),
    [IsLocked] INT,
    [Border] INT,
    [IsWidthPercentage] INT,
    [MinWidth] INT,
    [WidthLabel] INT,
    [SpaceToRight] INT,
    [AutoImport] INT,
    [PrefillFromGuar] INT,
    [ValueLabelEnglish] TEXT,
    [PickListVisEnglish] TEXT,
    CONSTRAINT [PK__eformfie__F9E59D5743A717C5] PRIMARY KEY CLUSTERED ([EFormFieldNum])
);

-- CreateTable
CREATE TABLE [dbo].[eformfielddef] (
    [EFormFieldDefNum] BIGINT NOT NULL,
    [EFormDefNum] BIGINT,
    [FieldType] INT,
    [DbLink] VARCHAR(255),
    [ValueLabel] TEXT,
    [ItemOrder] INT,
    [PickListVis] TEXT,
    [PickListDb] TEXT,
    [IsHorizStacking] INT,
    [IsTextWrap] INT,
    [Width] INT,
    [FontScale] INT,
    [IsRequired] INT,
    [ConditionalParent] VARCHAR(255),
    [ConditionalValue] TEXT,
    [LabelAlign] INT,
    [SpaceBelow] INT,
    [ReportableName] VARCHAR(255),
    [IsLocked] INT,
    [Border] INT,
    [IsWidthPercentage] INT,
    [MinWidth] INT,
    [WidthLabel] INT,
    [SpaceToRight] INT,
    [AutoImport] INT,
    [PrefillFromGuar] INT,
    CONSTRAINT [PK__eformfie__3523CD003362570D] PRIMARY KEY CLUSTERED ([EFormFieldDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[eformimportrule] (
    [EFormImportRuleNum] BIGINT NOT NULL,
    [FieldName] VARCHAR(255),
    [Situation] INT,
    [Action] INT,
    CONSTRAINT [PK__eformimp__79CFBF0554263D79] PRIMARY KEY CLUSTERED ([EFormImportRuleNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehramendment] (
    [EhrAmendmentNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [IsAccepted] INT,
    [Description] TEXT,
    [Source] INT,
    [SourceName] TEXT,
    [FileName] VARCHAR(255),
    [RawBase64] TEXT,
    [DateTRequest] DATETIME2,
    [DateTAcceptDeny] DATETIME2,
    [DateTAppend] DATETIME2,
    CONSTRAINT [PK__ehramend__ADEC3683D26B3FAC] PRIMARY KEY CLUSTERED ([EhrAmendmentNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehraptobs] (
    [EhrAptObsNum] BIGINT NOT NULL,
    [AptNum] BIGINT,
    [IdentifyingCode] INT,
    [ValType] INT,
    [ValReported] VARCHAR(255),
    [UcumCode] VARCHAR(255),
    [ValCodeSystem] VARCHAR(255),
    CONSTRAINT [PK__ehraptob__C4286F3B1E65EDF1] PRIMARY KEY CLUSTERED ([EhrAptObsNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrcareplan] (
    [EhrCarePlanNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [SnomedEducation] VARCHAR(255),
    [Instructions] VARCHAR(255),
    [DatePlanned] DATE,
    CONSTRAINT [PK__ehrcarep__02C03B87556DAFAC] PRIMARY KEY CLUSTERED ([EhrCarePlanNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrcode] (
    [CodeValue] VARCHAR(30) NOT NULL,
    CONSTRAINT [PK__ehrcode__5A6CD8E31C478C61] PRIMARY KEY CLUSTERED ([CodeValue])
);

-- CreateTable
CREATE TABLE [dbo].[ehrlab] (
    [EhrLabNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [OrderControlCode] VARCHAR(255),
    [PlacerOrderNum] VARCHAR(255),
    [PlacerOrderNamespace] VARCHAR(255),
    [PlacerOrderUniversalID] VARCHAR(255),
    [PlacerOrderUniversalIDType] VARCHAR(255),
    [FillerOrderNum] VARCHAR(255),
    [FillerOrderNamespace] VARCHAR(255),
    [FillerOrderUniversalID] VARCHAR(255),
    [FillerOrderUniversalIDType] VARCHAR(255),
    [PlacerGroupNum] VARCHAR(255),
    [PlacerGroupNamespace] VARCHAR(255),
    [PlacerGroupUniversalID] VARCHAR(255),
    [PlacerGroupUniversalIDType] VARCHAR(255),
    [OrderingProviderID] VARCHAR(255),
    [OrderingProviderLName] VARCHAR(255),
    [OrderingProviderFName] VARCHAR(255),
    [OrderingProviderMiddleNames] VARCHAR(255),
    [OrderingProviderSuffix] VARCHAR(255),
    [OrderingProviderPrefix] VARCHAR(255),
    [OrderingProviderAssigningAuthorityNamespaceID] VARCHAR(255),
    [OrderingProviderAssigningAuthorityUniversalID] VARCHAR(255),
    [OrderingProviderAssigningAuthorityIDType] VARCHAR(255),
    [OrderingProviderNameTypeCode] VARCHAR(255),
    [OrderingProviderIdentifierTypeCode] VARCHAR(255),
    [SetIdOBR] BIGINT,
    [UsiID] VARCHAR(255),
    [UsiText] VARCHAR(255),
    [UsiCodeSystemName] VARCHAR(255),
    [UsiIDAlt] VARCHAR(255),
    [UsiTextAlt] VARCHAR(255),
    [UsiCodeSystemNameAlt] VARCHAR(255),
    [UsiTextOriginal] VARCHAR(255),
    [ObservationDateTimeStart] VARCHAR(255),
    [ObservationDateTimeEnd] VARCHAR(255),
    [SpecimenActionCode] VARCHAR(255),
    [ResultDateTime] VARCHAR(255),
    [ResultStatus] VARCHAR(255),
    [ParentObservationID] VARCHAR(255),
    [ParentObservationText] VARCHAR(255),
    [ParentObservationCodeSystemName] VARCHAR(255),
    [ParentObservationIDAlt] VARCHAR(255),
    [ParentObservationTextAlt] VARCHAR(255),
    [ParentObservationCodeSystemNameAlt] VARCHAR(255),
    [ParentObservationTextOriginal] VARCHAR(255),
    [ParentObservationSubID] VARCHAR(255),
    [ParentPlacerOrderNum] VARCHAR(255),
    [ParentPlacerOrderNamespace] VARCHAR(255),
    [ParentPlacerOrderUniversalID] VARCHAR(255),
    [ParentPlacerOrderUniversalIDType] VARCHAR(255),
    [ParentFillerOrderNum] VARCHAR(255),
    [ParentFillerOrderNamespace] VARCHAR(255),
    [ParentFillerOrderUniversalID] VARCHAR(255),
    [ParentFillerOrderUniversalIDType] VARCHAR(255),
    [ListEhrLabResultsHandlingF] INT,
    [ListEhrLabResultsHandlingN] INT,
    [TQ1SetId] BIGINT,
    [TQ1DateTimeStart] VARCHAR(255),
    [TQ1DateTimeEnd] VARCHAR(255),
    [IsCpoe] INT,
    [OriginalPIDSegment] TEXT,
    CONSTRAINT [PK__ehrlab__93B241A71CF01EFF] PRIMARY KEY CLUSTERED ([EhrLabNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrlabclinicalinfo] (
    [EhrLabClinicalInfoNum] BIGINT NOT NULL,
    [EhrLabNum] BIGINT,
    [ClinicalInfoID] VARCHAR(255),
    [ClinicalInfoText] VARCHAR(255),
    [ClinicalInfoCodeSystemName] VARCHAR(255),
    [ClinicalInfoIDAlt] VARCHAR(255),
    [ClinicalInfoTextAlt] VARCHAR(255),
    [ClinicalInfoCodeSystemNameAlt] VARCHAR(255),
    [ClinicalInfoTextOriginal] VARCHAR(255),
    CONSTRAINT [PK__ehrlabcl__0C899B9AB125C2F2] PRIMARY KEY CLUSTERED ([EhrLabClinicalInfoNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrlabimage] (
    [EhrLabImageNum] BIGINT NOT NULL,
    [EhrLabNum] BIGINT,
    [DocNum] BIGINT,
    CONSTRAINT [PK__ehrlabim__DC0CB7EABF787D3D] PRIMARY KEY CLUSTERED ([EhrLabImageNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrlabnote] (
    [EhrLabNoteNum] BIGINT NOT NULL,
    [EhrLabNum] BIGINT,
    [EhrLabResultNum] BIGINT,
    [Comments] TEXT,
    CONSTRAINT [PK__ehrlabno__35F1165DB0B26C7D] PRIMARY KEY CLUSTERED ([EhrLabNoteNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrlabresult] (
    [EhrLabResultNum] BIGINT NOT NULL,
    [EhrLabNum] BIGINT,
    [SetIdOBX] BIGINT,
    [ValueType] VARCHAR(255),
    [ObservationIdentifierID] VARCHAR(255),
    [ObservationIdentifierText] VARCHAR(255),
    [ObservationIdentifierCodeSystemName] VARCHAR(255),
    [ObservationIdentifierIDAlt] VARCHAR(255),
    [ObservationIdentifierTextAlt] VARCHAR(255),
    [ObservationIdentifierCodeSystemNameAlt] VARCHAR(255),
    [ObservationIdentifierTextOriginal] VARCHAR(255),
    [ObservationIdentifierSub] VARCHAR(255),
    [ObservationValueCodedElementID] VARCHAR(255),
    [ObservationValueCodedElementText] VARCHAR(255),
    [ObservationValueCodedElementCodeSystemName] VARCHAR(255),
    [ObservationValueCodedElementIDAlt] VARCHAR(255),
    [ObservationValueCodedElementTextAlt] VARCHAR(255),
    [ObservationValueCodedElementCodeSystemNameAlt] VARCHAR(255),
    [ObservationValueCodedElementTextOriginal] VARCHAR(255),
    [ObservationValueDateTime] VARCHAR(255),
    [ObservationValueTime] TIME,
    [ObservationValueComparator] VARCHAR(255),
    [ObservationValueNumber1] FLOAT(53),
    [ObservationValueSeparatorOrSuffix] VARCHAR(255),
    [ObservationValueNumber2] FLOAT(53),
    [ObservationValueNumeric] FLOAT(53),
    [ObservationValueText] VARCHAR(255),
    [UnitsID] VARCHAR(255),
    [UnitsText] VARCHAR(255),
    [UnitsCodeSystemName] VARCHAR(255),
    [UnitsIDAlt] VARCHAR(255),
    [UnitsTextAlt] VARCHAR(255),
    [UnitsCodeSystemNameAlt] VARCHAR(255),
    [UnitsTextOriginal] VARCHAR(255),
    [referenceRange] VARCHAR(255),
    [AbnormalFlags] VARCHAR(255),
    [ObservationResultStatus] VARCHAR(255),
    [ObservationDateTime] VARCHAR(255),
    [AnalysisDateTime] VARCHAR(255),
    [PerformingOrganizationName] VARCHAR(255),
    [PerformingOrganizationNameAssigningAuthorityNamespaceId] VARCHAR(255),
    [PerformingOrganizationNameAssigningAuthorityUniversalId] VARCHAR(255),
    [PerformingOrganizationNameAssigningAuthorityUniversalIdType] VARCHAR(255),
    [PerformingOrganizationIdentifierTypeCode] VARCHAR(255),
    [PerformingOrganizationIdentifier] VARCHAR(255),
    [PerformingOrganizationAddressStreet] VARCHAR(255),
    [PerformingOrganizationAddressOtherDesignation] VARCHAR(255),
    [PerformingOrganizationAddressCity] VARCHAR(255),
    [PerformingOrganizationAddressStateOrProvince] VARCHAR(255),
    [PerformingOrganizationAddressZipOrPostalCode] VARCHAR(255),
    [PerformingOrganizationAddressCountryCode] VARCHAR(255),
    [PerformingOrganizationAddressAddressType] VARCHAR(255),
    [PerformingOrganizationAddressCountyOrParishCode] VARCHAR(255),
    [MedicalDirectorID] VARCHAR(255),
    [MedicalDirectorLName] VARCHAR(255),
    [MedicalDirectorFName] VARCHAR(255),
    [MedicalDirectorMiddleNames] VARCHAR(255),
    [MedicalDirectorSuffix] VARCHAR(255),
    [MedicalDirectorPrefix] VARCHAR(255),
    [MedicalDirectorAssigningAuthorityNamespaceID] VARCHAR(255),
    [MedicalDirectorAssigningAuthorityUniversalID] VARCHAR(255),
    [MedicalDirectorAssigningAuthorityIDType] VARCHAR(255),
    [MedicalDirectorNameTypeCode] VARCHAR(255),
    [MedicalDirectorIdentifierTypeCode] VARCHAR(255),
    CONSTRAINT [PK__ehrlabre__129CA05FD615BEC2] PRIMARY KEY CLUSTERED ([EhrLabResultNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrlabresultscopyto] (
    [EhrLabResultsCopyToNum] BIGINT NOT NULL,
    [EhrLabNum] BIGINT,
    [CopyToID] VARCHAR(255),
    [CopyToLName] VARCHAR(255),
    [CopyToFName] VARCHAR(255),
    [CopyToMiddleNames] VARCHAR(255),
    [CopyToSuffix] VARCHAR(255),
    [CopyToPrefix] VARCHAR(255),
    [CopyToAssigningAuthorityNamespaceID] VARCHAR(255),
    [CopyToAssigningAuthorityUniversalID] VARCHAR(255),
    [CopyToAssigningAuthorityIDType] VARCHAR(255),
    [CopyToNameTypeCode] VARCHAR(255),
    [CopyToIdentifierTypeCode] VARCHAR(255),
    CONSTRAINT [PK__ehrlabre__04E800E90E458B7F] PRIMARY KEY CLUSTERED ([EhrLabResultsCopyToNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrlabspecimen] (
    [EhrLabSpecimenNum] BIGINT NOT NULL,
    [EhrLabNum] BIGINT,
    [SetIdSPM] BIGINT,
    [SpecimenTypeID] VARCHAR(255),
    [SpecimenTypeText] VARCHAR(255),
    [SpecimenTypeCodeSystemName] VARCHAR(255),
    [SpecimenTypeIDAlt] VARCHAR(255),
    [SpecimenTypeTextAlt] VARCHAR(255),
    [SpecimenTypeCodeSystemNameAlt] VARCHAR(255),
    [SpecimenTypeTextOriginal] VARCHAR(255),
    [CollectionDateTimeStart] VARCHAR(255),
    [CollectionDateTimeEnd] VARCHAR(255),
    CONSTRAINT [PK__ehrlabsp__07FB31BC7D464F6F] PRIMARY KEY CLUSTERED ([EhrLabSpecimenNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrlabspecimencondition] (
    [EhrLabSpecimenConditionNum] BIGINT NOT NULL,
    [EhrLabSpecimenNum] BIGINT,
    [SpecimenConditionID] VARCHAR(255),
    [SpecimenConditionText] VARCHAR(255),
    [SpecimenConditionCodeSystemName] VARCHAR(255),
    [SpecimenConditionIDAlt] VARCHAR(255),
    [SpecimenConditionTextAlt] VARCHAR(255),
    [SpecimenConditionCodeSystemNameAlt] VARCHAR(255),
    [SpecimenConditionTextOriginal] VARCHAR(255),
    CONSTRAINT [PK__ehrlabsp__FC409E5FC2C1AC5F] PRIMARY KEY CLUSTERED ([EhrLabSpecimenConditionNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrlabspecimenrejectreason] (
    [EhrLabSpecimenRejectReasonNum] BIGINT NOT NULL,
    [EhrLabSpecimenNum] BIGINT,
    [SpecimenRejectReasonID] VARCHAR(255),
    [SpecimenRejectReasonText] VARCHAR(255),
    [SpecimenRejectReasonCodeSystemName] VARCHAR(255),
    [SpecimenRejectReasonIDAlt] VARCHAR(255),
    [SpecimenRejectReasonTextAlt] VARCHAR(255),
    [SpecimenRejectReasonCodeSystemNameAlt] VARCHAR(255),
    [SpecimenRejectReasonTextOriginal] VARCHAR(255),
    CONSTRAINT [PK__ehrlabsp__F29A95863C89031D] PRIMARY KEY CLUSTERED ([EhrLabSpecimenRejectReasonNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrmeasure] (
    [EhrMeasureNum] BIGINT NOT NULL,
    [MeasureType] INT,
    [Numerator] SMALLINT,
    [Denominator] SMALLINT,
    CONSTRAINT [PK__ehrmeasu__F9CE53412B620981] PRIMARY KEY CLUSTERED ([EhrMeasureNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrmeasureevent] (
    [EhrMeasureEventNum] BIGINT NOT NULL,
    [DateTEvent] DATETIME2,
    [EventType] INT,
    [PatNum] BIGINT,
    [MoreInfo] VARCHAR(255),
    [CodeValueEvent] VARCHAR(30),
    [CodeSystemEvent] VARCHAR(30),
    [CodeValueResult] VARCHAR(30),
    [CodeSystemResult] VARCHAR(30),
    [FKey] BIGINT,
    [TobaccoCessationDesire] INT,
    [DateStartTobacco] DATE,
    CONSTRAINT [PK__ehrmeasu__5C373907E6DD93A4] PRIMARY KEY CLUSTERED ([EhrMeasureEventNum]),
    CONSTRAINT [UQ__ehrmeasu__5E7B47DE8F4C63EE] UNIQUE NONCLUSTERED ([CodeValueResult])
);

-- CreateTable
CREATE TABLE [dbo].[ehrnotperformed] (
    [EhrNotPerformedNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ProvNum] BIGINT,
    [CodeValue] VARCHAR(30),
    [CodeSystem] VARCHAR(255),
    [CodeValueReason] VARCHAR(30),
    [CodeSystemReason] VARCHAR(255),
    [Note] TEXT,
    [DateEntry] DATE,
    CONSTRAINT [PK__ehrnotpe__B63FB31B2A998549] PRIMARY KEY CLUSTERED ([EhrNotPerformedNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrpatient] (
    [PatNum] BIGINT,
    [MotherMaidenFname] VARCHAR(255),
    [MotherMaidenLname] VARCHAR(255),
    [VacShareOk] INT,
    [MedicaidState] VARCHAR(50),
    [SexualOrientation] VARCHAR(255),
    [GenderIdentity] VARCHAR(255),
    [SexualOrientationNote] VARCHAR(255),
    [GenderIdentityNote] VARCHAR(255),
    [DischargeDate] DATETIME2
);

-- CreateTable
CREATE TABLE [dbo].[ehrprovkey] (
    [EhrProvKeyNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [LName] VARCHAR(255),
    [FName] VARCHAR(255),
    [ProvKey] VARCHAR(255),
    [FullTimeEquiv] FLOAT(53),
    [Notes] TEXT,
    [YearValue] INT,
    CONSTRAINT [PK__ehrprovk__C13E5C9218DAA2B8] PRIMARY KEY CLUSTERED ([EhrProvKeyNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrquarterlykey] (
    [EhrQuarterlyKeyNum] BIGINT NOT NULL,
    [YearValue] INT,
    [QuarterValue] INT,
    [PracticeName] VARCHAR(255),
    [KeyValue] VARCHAR(255),
    [PatNum] BIGINT,
    [Notes] TEXT,
    CONSTRAINT [PK__ehrquart__2B6B3F4F5C860E1D] PRIMARY KEY CLUSTERED ([EhrQuarterlyKeyNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrsummaryccd] (
    [EhrSummaryCcdNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateSummary] DATE,
    [ContentSummary] TEXT,
    [EmailAttachNum] BIGINT,
    CONSTRAINT [PK__ehrsumma__9727B64A0A157753] PRIMARY KEY CLUSTERED ([EhrSummaryCcdNum])
);

-- CreateTable
CREATE TABLE [dbo].[ehrtrigger] (
    [EhrTriggerNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ProblemSnomedList] TEXT,
    [ProblemIcd9List] TEXT,
    [ProblemIcd10List] TEXT,
    [ProblemDefNumList] TEXT,
    [MedicationNumList] TEXT,
    [RxCuiList] TEXT,
    [CvxList] TEXT,
    [AllergyDefNumList] TEXT,
    [DemographicsList] TEXT,
    [LabLoincList] TEXT,
    [VitalLoincList] TEXT,
    [Instructions] TEXT,
    [Bibliography] TEXT,
    [Cardinality] INT,
    CONSTRAINT [PK__ehrtrigg__45BDABBB322B5899] PRIMARY KEY CLUSTERED ([EhrTriggerNum])
);

-- CreateTable
CREATE TABLE [dbo].[electid] (
    [ElectIDNum] BIGINT NOT NULL,
    [PayorID] VARCHAR(255),
    [CarrierName] VARCHAR(255),
    [IsMedicaid] INT,
    [ProviderTypes] VARCHAR(255),
    [Comments] TEXT,
    [CommBridge] INT,
    [Attributes] VARCHAR(255),
    CONSTRAINT [PK__electid__1DCC17011A9B2205] PRIMARY KEY CLUSTERED ([ElectIDNum])
);

-- CreateTable
CREATE TABLE [dbo].[emailaddress] (
    [EmailAddressNum] BIGINT NOT NULL,
    [SMTPserver] VARCHAR(255),
    [EmailUsername] VARCHAR(255),
    [EmailPassword] VARCHAR(255),
    [ServerPort] INT,
    [UseSSL] INT,
    [SenderAddress] VARCHAR(255),
    [Pop3ServerIncoming] VARCHAR(255),
    [ServerPortIncoming] INT,
    [UserNum] BIGINT,
    [AccessToken] VARCHAR(2000),
    [RefreshToken] TEXT,
    [DownloadInbox] INT,
    [QueryString] VARCHAR(1000),
    [AuthenticationType] INT,
    CONSTRAINT [PK__emailadd__9F207AB208111D3C] PRIMARY KEY CLUSTERED ([EmailAddressNum])
);

-- CreateTable
CREATE TABLE [dbo].[emailattach] (
    [EmailAttachNum] BIGINT NOT NULL,
    [EmailMessageNum] BIGINT,
    [DisplayedFileName] VARCHAR(255),
    [ActualFileName] VARCHAR(255),
    [EmailTemplateNum] BIGINT,
    CONSTRAINT [PK__emailatt__DEFD1A7BCF74FB81] PRIMARY KEY CLUSTERED ([EmailAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[emailautograph] (
    [EmailAutographNum] BIGINT NOT NULL,
    [Description] TEXT,
    [EmailAddress] VARCHAR(255),
    [AutographText] TEXT,
    CONSTRAINT [PK__emailaut__44D089741E0D44E7] PRIMARY KEY CLUSTERED ([EmailAutographNum])
);

-- CreateTable
CREATE TABLE [dbo].[emailhostingtemplate] (
    [EmailHostingTemplateNum] BIGINT NOT NULL,
    [TemplateName] VARCHAR(255),
    [Subject] TEXT,
    [BodyPlainText] TEXT,
    [BodyHTML] TEXT,
    [TemplateId] BIGINT,
    [ClinicNum] BIGINT,
    [EmailTemplateType] VARCHAR(255),
    [TemplateType] VARCHAR(255),
    CONSTRAINT [PK__emailhos__BFE1A5DFD4D018B7] PRIMARY KEY CLUSTERED ([EmailHostingTemplateNum])
);

-- CreateTable
CREATE TABLE [dbo].[emailmessage] (
    [EmailMessageNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ToAddress] TEXT,
    [FromAddress] TEXT,
    [Subject] TEXT,
    [BodyText] TEXT,
    [MsgDateTime] DATETIME2,
    [SentOrReceived] INT,
    [RecipientAddress] VARCHAR(255),
    [RawEmailIn] TEXT,
    [ProvNumWebMail] BIGINT,
    [PatNumSubj] BIGINT,
    [CcAddress] TEXT,
    [BccAddress] TEXT,
    [HideIn] INT,
    [AptNum] BIGINT,
    [UserNum] BIGINT,
    [HtmlType] INT,
    [SecDateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    [MsgType] VARCHAR(255),
    [FailReason] TEXT,
    CONSTRAINT [PK__emailmes__4CF2EB9BF6319E03] PRIMARY KEY CLUSTERED ([EmailMessageNum])
);

-- CreateTable
CREATE TABLE [dbo].[emailmessageuid] (
    [EmailMessageUidNum] BIGINT NOT NULL,
    [MsgId] TEXT,
    [RecipientAddress] VARCHAR(255),
    CONSTRAINT [PK__emailmes__929CC1703B6616D1] PRIMARY KEY CLUSTERED ([EmailMessageUidNum])
);

-- CreateTable
CREATE TABLE [dbo].[emailsecure] (
    [EmailSecureNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [PatNum] BIGINT,
    [EmailMessageNum] BIGINT,
    [EmailChainFK] BIGINT,
    [EmailFK] BIGINT,
    [DateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__emailsec__8C7FE0EDFE34CF66] PRIMARY KEY CLUSTERED ([EmailSecureNum])
);

-- CreateTable
CREATE TABLE [dbo].[emailsecureattach] (
    [EmailSecureAttachNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [EmailAttachNum] BIGINT,
    [EmailSecureNum] BIGINT,
    [AttachmentGuid] VARCHAR(50),
    [DisplayedFileName] VARCHAR(255),
    [Extension] VARCHAR(255),
    [DateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__emailsec__4380F2D3147112DB] PRIMARY KEY CLUSTERED ([EmailSecureAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[emailtemplate] (
    [EmailTemplateNum] BIGINT NOT NULL,
    [Subject] TEXT,
    [BodyText] TEXT,
    [Description] TEXT,
    [TemplateType] INT,
    CONSTRAINT [PK__emailtem__BF80E905C73CA2FF] PRIMARY KEY CLUSTERED ([EmailTemplateNum])
);

-- CreateTable
CREATE TABLE [dbo].[employee] (
    [EmployeeNum] BIGINT NOT NULL,
    [LName] VARCHAR(255),
    [FName] VARCHAR(255),
    [MiddleI] VARCHAR(255),
    [IsHidden] INT,
    [ClockStatus] VARCHAR(255),
    [PhoneExt] INT,
    [PayrollID] VARCHAR(255),
    [WirelessPhone] VARCHAR(255),
    [EmailWork] VARCHAR(255),
    [EmailPersonal] VARCHAR(255),
    [IsFurloughed] INT,
    [IsWorkingHome] INT,
    [ReportsTo] BIGINT,
    CONSTRAINT [PK__employee__7A8F0B4980D615D1] PRIMARY KEY CLUSTERED ([EmployeeNum])
);

-- CreateTable
CREATE TABLE [dbo].[employer] (
    [EmployerNum] BIGINT NOT NULL,
    [EmpName] VARCHAR(255),
    [Address] VARCHAR(255),
    [Address2] VARCHAR(255),
    [City] VARCHAR(255),
    [State] VARCHAR(255),
    [Zip] VARCHAR(255),
    [Phone] VARCHAR(255),
    CONSTRAINT [PK__employer__543177163B0761A0] PRIMARY KEY CLUSTERED ([EmployerNum])
);

-- CreateTable
CREATE TABLE [dbo].[encounter] (
    [EncounterNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ProvNum] BIGINT,
    [CodeValue] VARCHAR(30),
    [CodeSystem] VARCHAR(255),
    [Note] TEXT,
    [DateEncounter] DATE,
    CONSTRAINT [PK__encounte__1F6D072572D1CCCE] PRIMARY KEY CLUSTERED ([EncounterNum])
);

-- CreateTable
CREATE TABLE [dbo].[entrylog] (
    [EntryLogNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [FKeyType] INT,
    [FKey] BIGINT,
    [LogSource] INT,
    [EntryDateTime] DATETIME2,
    CONSTRAINT [PK__entrylog__37835F6387B14E22] PRIMARY KEY CLUSTERED ([EntryLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[eobattach] (
    [EobAttachNum] BIGINT NOT NULL,
    [ClaimPaymentNum] BIGINT,
    [DateTCreated] DATETIME2,
    [FileName] VARCHAR(255),
    [RawBase64] TEXT,
    [ClaimNumPreAuth] BIGINT,
    CONSTRAINT [PK__eobattac__D60D7BD6D22D3C3F] PRIMARY KEY CLUSTERED ([EobAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[equipment] (
    [EquipmentNum] BIGINT NOT NULL,
    [Description] TEXT,
    [SerialNumber] VARCHAR(255),
    [ModelYear] VARCHAR(2),
    [DatePurchased] DATE,
    [DateSold] DATE,
    [PurchaseCost] FLOAT(53),
    [MarketValue] FLOAT(53),
    [Location] TEXT,
    [DateEntry] DATE,
    [ProvNumCheckedOut] BIGINT,
    [DateCheckedOut] DATE,
    [DateExpectedBack] DATE,
    [DispenseNote] TEXT,
    [Status] TEXT,
    CONSTRAINT [PK__equipmen__E49AFC87DC801528] PRIMARY KEY CLUSTERED ([EquipmentNum])
);

-- CreateTable
CREATE TABLE [dbo].[erouting] (
    [ERoutingNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [PatNum] BIGINT,
    [ClinicNum] BIGINT,
    [SecDateTEntry] DATETIME2,
    [IsComplete] INT,
    CONSTRAINT [PK__erouting__6CD252B89DF08045] PRIMARY KEY CLUSTERED ([ERoutingNum])
);

-- CreateTable
CREATE TABLE [dbo].[eroutingaction] (
    [ERoutingActionNum] BIGINT NOT NULL,
    [ERoutingNum] BIGINT,
    [ItemOrder] INT,
    [ERoutingActionType] INT,
    [UserNum] BIGINT,
    [IsComplete] INT,
    [DateTimeComplete] DATETIME2,
    [ForeignKeyType] INT,
    [ForeignKey] BIGINT,
    [LabelOverride] VARCHAR(255),
    CONSTRAINT [PK__erouting__9D70AB1C0B39E8FA] PRIMARY KEY CLUSTERED ([ERoutingActionNum])
);

-- CreateTable
CREATE TABLE [dbo].[eroutingactiondef] (
    [ERoutingActionDefNum] BIGINT NOT NULL,
    [ERoutingDefNum] BIGINT,
    [ERoutingActionType] INT,
    [ItemOrder] INT,
    [SecDateTEntry] DATETIME2,
    [DateTLastModified] DATETIME2,
    [ForeignKeyType] INT,
    [ForeignKey] BIGINT,
    [LabelOverride] VARCHAR(255),
    CONSTRAINT [PK__erouting__94ECFDA1B85984F3] PRIMARY KEY CLUSTERED ([ERoutingActionDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[eroutingdef] (
    [ERoutingDefNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [Description] VARCHAR(255),
    [UserNumCreated] BIGINT,
    [UserNumModified] BIGINT,
    [SecDateTEntered] DATETIME2,
    [DateLastModified] DATETIME2,
    CONSTRAINT [PK__erouting__30CFDF41D18C09F1] PRIMARY KEY CLUSTERED ([ERoutingDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[eroutingdeflink] (
    [ERoutingDefLinkNum] BIGINT NOT NULL,
    [ERoutingDefNum] BIGINT,
    [Fkey] BIGINT,
    [ERoutingType] INT,
    CONSTRAINT [PK__erouting__F641914E12A444C2] PRIMARY KEY CLUSTERED ([ERoutingDefLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[erxlog] (
    [ErxLogNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [MsgText] TEXT,
    [DateTStamp] DATETIME2,
    [ProvNum] BIGINT,
    [UserNum] BIGINT,
    CONSTRAINT [PK__erxlog__7DF6B9246FD103FE] PRIMARY KEY CLUSTERED ([ErxLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[eservicelog] (
    [EServiceLogNum] BIGINT NOT NULL,
    [LogDateTime] DATETIME2,
    [PatNum] BIGINT,
    [EServiceType] INT,
    [EServiceAction] SMALLINT,
    [KeyType] SMALLINT,
    [LogGuid] VARCHAR(36),
    [ClinicNum] BIGINT,
    [FKey] BIGINT,
    [DateTimeUploaded] DATETIME2,
    [Note] VARCHAR(255),
    CONSTRAINT [PK__eservice__0C4D60F198DC8EDC] PRIMARY KEY CLUSTERED ([EServiceLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[eserviceshortguid] (
    [EServiceShortGuidNum] BIGINT NOT NULL,
    [EServiceCode] VARCHAR(255),
    [ShortGuid] VARCHAR(255),
    [ShortURL] VARCHAR(255),
    [FKey] BIGINT,
    [FKeyType] VARCHAR(255),
    [DateTimeExpiration] DATETIME2,
    [DateTEntry] DATETIME2,
    CONSTRAINT [PK__eservice__39D3C6777A3E79C7] PRIMARY KEY CLUSTERED ([EServiceShortGuidNum])
);

-- CreateTable
CREATE TABLE [dbo].[eservicesignal] (
    [EServiceSignalNum] BIGINT NOT NULL,
    [ServiceCode] INT,
    [ReasonCategory] INT,
    [ReasonCode] INT,
    [Severity] INT,
    [Description] TEXT,
    [SigDateTime] DATETIME2,
    [Tag] TEXT,
    [IsProcessed] INT,
    CONSTRAINT [PK__eservice__A64F1FD4159F44EC] PRIMARY KEY CLUSTERED ([EServiceSignalNum])
);

-- CreateTable
CREATE TABLE [dbo].[etrans] (
    [EtransNum] BIGINT NOT NULL,
    [DateTimeTrans] DATETIME2,
    [ClearingHouseNum] BIGINT,
    [Etype] INT,
    [ClaimNum] BIGINT,
    [OfficeSequenceNumber] INT,
    [CarrierTransCounter] INT,
    [CarrierTransCounter2] INT,
    [CarrierNum] BIGINT,
    [CarrierNum2] BIGINT,
    [PatNum] BIGINT,
    [BatchNumber] INT,
    [AckCode] VARCHAR(255),
    [TransSetNum] INT,
    [Note] TEXT,
    [EtransMessageTextNum] BIGINT,
    [AckEtransNum] BIGINT,
    [PlanNum] BIGINT,
    [InsSubNum] BIGINT,
    [TranSetId835] VARCHAR(255),
    [CarrierNameRaw] VARCHAR(60),
    [PatientNameRaw] VARCHAR(133),
    [UserNum] BIGINT,
    CONSTRAINT [PK__etrans__00E2AD658BE3C18A] PRIMARY KEY CLUSTERED ([EtransNum])
);

-- CreateTable
CREATE TABLE [dbo].[etrans835] (
    [Etrans835Num] BIGINT NOT NULL,
    [EtransNum] BIGINT,
    [PayerName] VARCHAR(60),
    [TransRefNum] VARCHAR(50),
    [InsPaid] FLOAT(53),
    [ControlId] VARCHAR(9),
    [PaymentMethodCode] VARCHAR(3),
    [PatientName] VARCHAR(100),
    [Status] INT,
    [AutoProcessed] INT,
    [IsApproved] INT,
    CONSTRAINT [PK__etrans83__E6C9669D3CB5FCBE] PRIMARY KEY CLUSTERED ([Etrans835Num])
);

-- CreateTable
CREATE TABLE [dbo].[etrans835attach] (
    [Etrans835AttachNum] BIGINT NOT NULL,
    [EtransNum] BIGINT,
    [ClaimNum] BIGINT,
    [ClpSegmentIndex] INT,
    [DateTimeEntry] DATETIME2,
    CONSTRAINT [PK__etrans83__8A50CB47BBA58D89] PRIMARY KEY CLUSTERED ([Etrans835AttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[etransmessagetext] (
    [EtransMessageTextNum] BIGINT NOT NULL,
    [MessageText] TEXT,
    CONSTRAINT [PK__etransme__C1974361E05F018D] PRIMARY KEY CLUSTERED ([EtransMessageTextNum])
);

-- CreateTable
CREATE TABLE [dbo].[evaluation] (
    [EvaluationNum] BIGINT NOT NULL,
    [InstructNum] BIGINT,
    [StudentNum] BIGINT,
    [SchoolCourseNum] BIGINT,
    [EvalTitle] VARCHAR(255),
    [DateEval] DATE,
    [GradingScaleNum] BIGINT,
    [OverallGradeShowing] VARCHAR(255),
    [OverallGradeNumber] FLOAT(53),
    [Notes] TEXT,
    [GradeOverride] FLOAT(53),
    CONSTRAINT [PK__evaluati__73AEB5E67136904E] PRIMARY KEY CLUSTERED ([EvaluationNum])
);

-- CreateTable
CREATE TABLE [dbo].[evaluationcriterion] (
    [EvaluationCriterionNum] BIGINT NOT NULL,
    [EvaluationNum] BIGINT,
    [CriterionDescript] VARCHAR(255),
    [IsCategoryName] INT,
    [GradingScaleNum] BIGINT,
    [GradeShowing] VARCHAR(255),
    [GradeNumber] FLOAT(53),
    [Notes] TEXT,
    [ItemOrder] INT,
    [MaxPointsPoss] FLOAT(53),
    CONSTRAINT [PK__evaluati__76F03783ED1B1C3E] PRIMARY KEY CLUSTERED ([EvaluationCriterionNum])
);

-- CreateTable
CREATE TABLE [dbo].[evaluationcriteriondef] (
    [EvaluationCriterionDefNum] BIGINT NOT NULL,
    [EvaluationDefNum] BIGINT,
    [CriterionDescript] VARCHAR(255),
    [IsCategoryName] INT,
    [GradingScaleNum] BIGINT,
    [ItemOrder] INT,
    [MaxPointsPoss] FLOAT(53),
    CONSTRAINT [PK__evaluati__C735562760593B8E] PRIMARY KEY CLUSTERED ([EvaluationCriterionDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[evaluationdef] (
    [EvaluationDefNum] BIGINT NOT NULL,
    [SchoolCourseNum] BIGINT,
    [EvalTitle] VARCHAR(255),
    [GradingScaleNum] BIGINT,
    [SchoolCourseDefNum] BIGINT,
    CONSTRAINT [PK__evaluati__14FB2EC2696736E3] PRIMARY KEY CLUSTERED ([EvaluationDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[famaging] (
    [PatNum] BIGINT,
    [Bal_0_30] FLOAT(53),
    [Bal_31_60] FLOAT(53),
    [Bal_61_90] FLOAT(53),
    [BalOver90] FLOAT(53),
    [InsEst] FLOAT(53),
    [BalTotal] FLOAT(53),
    [PayPlanDue] FLOAT(53)
);

-- CreateTable
CREATE TABLE [dbo].[familyhealth] (
    [FamilyHealthNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [Relationship] INT,
    [DiseaseDefNum] BIGINT,
    [PersonName] VARCHAR(255),
    CONSTRAINT [PK__familyhe__924838368A171576] PRIMARY KEY CLUSTERED ([FamilyHealthNum])
);

-- CreateTable
CREATE TABLE [dbo].[fee] (
    [FeeNum] BIGINT NOT NULL,
    [Amount] FLOAT(53),
    [OldCode] VARCHAR(15),
    [FeeSched] BIGINT,
    [UseDefaultFee] INT,
    [UseDefaultCov] INT,
    [CodeNum] BIGINT,
    [ClinicNum] BIGINT,
    [ProvNum] BIGINT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    [DateEffective] DATE,
    CONSTRAINT [PK__fee__2CD5A9CB54CB048F] PRIMARY KEY CLUSTERED ([FeeNum])
);

-- CreateTable
CREATE TABLE [dbo].[feesched] (
    [FeeSchedNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [FeeSchedType] INT,
    [ItemOrder] INT,
    [IsHidden] INT,
    [IsGlobal] INT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__feesched__432734599DB09A94] PRIMARY KEY CLUSTERED ([FeeSchedNum])
);

-- CreateTable
CREATE TABLE [dbo].[feeschedgroup] (
    [FeeSchedGroupNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [FeeSchedNum] BIGINT,
    [ClinicNums] VARCHAR(255),
    CONSTRAINT [PK__feesched__E4A68B90C4ABDCCA] PRIMARY KEY CLUSTERED ([FeeSchedGroupNum])
);

-- CreateTable
CREATE TABLE [dbo].[feeschednote] (
    [FeeSchedNoteNum] BIGINT NOT NULL,
    [FeeSchedNum] BIGINT,
    [ClinicNums] TEXT,
    [Note] TEXT,
    [DateEntry] DATE,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__feesched__5B3E4882CC0DE886] PRIMARY KEY CLUSTERED ([FeeSchedNoteNum])
);

-- CreateTable
CREATE TABLE [dbo].[fhircontactpoint] (
    [FHIRContactPointNum] BIGINT NOT NULL,
    [FHIRSubscriptionNum] BIGINT,
    [ContactSystem] INT,
    [ContactValue] VARCHAR(255),
    [ContactUse] INT,
    [ItemOrder] INT,
    [DateStart] DATE,
    [DateEnd] DATE,
    CONSTRAINT [PK__fhircont__397434D4CAFC435B] PRIMARY KEY CLUSTERED ([FHIRContactPointNum])
);

-- CreateTable
CREATE TABLE [dbo].[fhirsubscription] (
    [FHIRSubscriptionNum] BIGINT NOT NULL,
    [Criteria] VARCHAR(255),
    [Reason] VARCHAR(255),
    [SubStatus] INT,
    [ErrorNote] TEXT,
    [ChannelType] INT,
    [ChannelEndpoint] VARCHAR(255),
    [ChannelPayLoad] VARCHAR(255),
    [ChannelHeader] VARCHAR(255),
    [DateEnd] DATETIME2,
    [APIKeyHash] VARCHAR(255),
    CONSTRAINT [PK__fhirsubs__8A8E0E4555503202] PRIMARY KEY CLUSTERED ([FHIRSubscriptionNum])
);

-- CreateTable
CREATE TABLE [dbo].[fielddeflink] (
    [FieldDefLinkNum] BIGINT NOT NULL,
    [FieldDefNum] BIGINT,
    [FieldDefType] INT,
    [FieldLocation] INT,
    CONSTRAINT [PK__fielddef__4A20D8DC2FC8F055] PRIMARY KEY CLUSTERED ([FieldDefLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[formpat] (
    [FormPatNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [FormDateTime] DATETIME2,
    CONSTRAINT [PK__formpat__54833A2ABAA5070A] PRIMARY KEY CLUSTERED ([FormPatNum])
);

-- CreateTable
CREATE TABLE [dbo].[gradingscale] (
    [GradingScaleNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ScaleType] INT,
    CONSTRAINT [PK__gradings__873BCC21382738D9] PRIMARY KEY CLUSTERED ([GradingScaleNum])
);

-- CreateTable
CREATE TABLE [dbo].[gradingscaleitem] (
    [GradingScaleItemNum] BIGINT NOT NULL,
    [GradingScaleNum] BIGINT,
    [GradeShowing] VARCHAR(255),
    [GradeNumber] FLOAT(53),
    [Description] VARCHAR(255),
    CONSTRAINT [PK__gradings__654D24B94D3F0C89] PRIMARY KEY CLUSTERED ([GradingScaleItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[grouppermission] (
    [GroupPermNum] BIGINT NOT NULL,
    [NewerDate] DATE,
    [NewerDays] INT,
    [UserGroupNum] BIGINT,
    [PermType] SMALLINT,
    [FKey] BIGINT,
    CONSTRAINT [PK__groupper__F120085BF52AA13E] PRIMARY KEY CLUSTERED ([GroupPermNum])
);

-- CreateTable
CREATE TABLE [dbo].[guardian] (
    [GuardianNum] BIGINT NOT NULL,
    [PatNumChild] BIGINT,
    [PatNumGuardian] BIGINT,
    [Relationship] INT,
    [IsGuardian] INT,
    CONSTRAINT [PK__guardian__4CEB2F465FE7FBB6] PRIMARY KEY CLUSTERED ([GuardianNum])
);

-- CreateTable
CREATE TABLE [dbo].[hcpcs] (
    [HcpcsNum] BIGINT NOT NULL,
    [HcpcsCode] VARCHAR(255),
    [DescriptionShort] VARCHAR(255),
    CONSTRAINT [PK__hcpcs__6407AC21BB10AAF9] PRIMARY KEY CLUSTERED ([HcpcsNum])
);

-- CreateTable
CREATE TABLE [dbo].[hieclinic] (
    [HieClinicNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [SupportedCarrierFlags] INT,
    [PathExportCCD] VARCHAR(255),
    [TimeOfDayExportCCD] BIGINT,
    [IsEnabled] INT,
    CONSTRAINT [PK__hieclini__9E7F782B8EEDAE93] PRIMARY KEY CLUSTERED ([HieClinicNum])
);

-- CreateTable
CREATE TABLE [dbo].[hiequeue] (
    [HieQueueNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    CONSTRAINT [PK__hiequeue__2AEDB6B115BE0D7C] PRIMARY KEY CLUSTERED ([HieQueueNum])
);

-- CreateTable
CREATE TABLE [dbo].[histappointment] (
    [HistApptNum] BIGINT NOT NULL,
    [HistUserNum] BIGINT,
    [HistDateTStamp] DATETIME2,
    [HistApptAction] INT,
    [ApptSource] INT,
    [AptNum] BIGINT,
    [PatNum] BIGINT,
    [AptStatus] INT,
    [Pattern] VARCHAR(255),
    [Confirmed] BIGINT,
    [TimeLocked] INT,
    [Op] BIGINT,
    [Note] TEXT,
    [ProvNum] BIGINT,
    [ProvHyg] BIGINT,
    [AptDateTime] DATETIME2,
    [NextAptNum] BIGINT,
    [UnschedStatus] BIGINT,
    [IsNewPatient] INT,
    [ProcDescript] TEXT,
    [Assistant] BIGINT,
    [ClinicNum] BIGINT,
    [IsHygiene] INT,
    [DateTStamp] DATETIME2,
    [DateTimeArrived] DATETIME2,
    [DateTimeSeated] DATETIME2,
    [DateTimeDismissed] DATETIME2,
    [InsPlan1] BIGINT,
    [InsPlan2] BIGINT,
    [DateTimeAskedToArrive] DATETIME2,
    [ProcsColored] TEXT,
    [ColorOverride] INT,
    [AppointmentTypeNum] BIGINT,
    [SecUserNumEntry] BIGINT,
    [SecDateTEntry] DATETIME2,
    [Priority] INT,
    [ProvBarText] VARCHAR(60),
    [PatternSecondary] VARCHAR(255),
    [SecurityHash] VARCHAR(255),
    [ItemOrderPlanned] INT,
    [IsMirrored] INT,
    CONSTRAINT [PK__histappo__89BEA37F8B439614] PRIMARY KEY CLUSTERED ([HistApptNum])
);

-- CreateTable
CREATE TABLE [dbo].[hl7def] (
    [HL7DefNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ModeTx] INT,
    [IncomingFolder] VARCHAR(255),
    [OutgoingFolder] VARCHAR(255),
    [IncomingPort] VARCHAR(255),
    [OutgoingIpPort] VARCHAR(255),
    [FieldSeparator] VARCHAR(5),
    [ComponentSeparator] VARCHAR(5),
    [SubcomponentSeparator] VARCHAR(5),
    [RepetitionSeparator] VARCHAR(5),
    [EscapeCharacter] VARCHAR(5),
    [IsInternal] INT,
    [InternalType] VARCHAR(255),
    [InternalTypeVersion] VARCHAR(50),
    [IsEnabled] INT,
    [Note] TEXT,
    [HL7Server] VARCHAR(255),
    [HL7ServiceName] VARCHAR(255),
    [ShowDemographics] INT,
    [ShowAppts] INT,
    [ShowAccount] INT,
    [IsQuadAsToothNum] INT,
    [LabResultImageCat] BIGINT,
    [SftpUsername] VARCHAR(255),
    [SftpPassword] VARCHAR(255),
    [SftpInSocket] VARCHAR(255),
    [HasLongDCodes] INT,
    [IsProcApptEnforced] INT,
    CONSTRAINT [PK__hl7def__E2C4C376FD88FD30] PRIMARY KEY CLUSTERED ([HL7DefNum])
);

-- CreateTable
CREATE TABLE [dbo].[hl7deffield] (
    [HL7DefFieldNum] BIGINT NOT NULL,
    [HL7DefSegmentNum] BIGINT,
    [OrdinalPos] INT,
    [TableId] VARCHAR(255),
    [DataType] VARCHAR(255),
    [FieldName] VARCHAR(255),
    [FixedText] TEXT,
    CONSTRAINT [PK__hl7deffi__1386BAB723FFA18F] PRIMARY KEY CLUSTERED ([HL7DefFieldNum])
);

-- CreateTable
CREATE TABLE [dbo].[hl7defmessage] (
    [HL7DefMessageNum] BIGINT NOT NULL,
    [HL7DefNum] BIGINT,
    [MessageType] VARCHAR(255),
    [EventType] VARCHAR(255),
    [InOrOut] INT,
    [ItemOrder] INT,
    [Note] TEXT,
    [MessageStructure] VARCHAR(255),
    CONSTRAINT [PK__hl7defme__2B7004085539984E] PRIMARY KEY CLUSTERED ([HL7DefMessageNum])
);

-- CreateTable
CREATE TABLE [dbo].[hl7defsegment] (
    [HL7DefSegmentNum] BIGINT NOT NULL,
    [HL7DefMessageNum] BIGINT,
    [ItemOrder] INT,
    [CanRepeat] INT,
    [IsOptional] INT,
    [SegmentName] VARCHAR(255),
    [Note] TEXT,
    CONSTRAINT [PK__hl7defse__B329D1F9DB6F32FA] PRIMARY KEY CLUSTERED ([HL7DefSegmentNum])
);

-- CreateTable
CREATE TABLE [dbo].[hl7msg] (
    [HL7MsgNum] BIGINT NOT NULL,
    [HL7Status] INT,
    [MsgText] TEXT,
    [AptNum] BIGINT,
    [DateTStamp] DATETIME2,
    [PatNum] BIGINT,
    [Note] TEXT,
    CONSTRAINT [PK__hl7msg__051BB725C970091F] PRIMARY KEY CLUSTERED ([HL7MsgNum])
);

-- CreateTable
CREATE TABLE [dbo].[hl7procattach] (
    [HL7ProcAttachNum] BIGINT NOT NULL,
    [HL7MsgNum] BIGINT,
    [ProcNum] BIGINT,
    CONSTRAINT [PK__hl7proca__4F796B7331AC8162] PRIMARY KEY CLUSTERED ([HL7ProcAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[icd10] (
    [Icd10Num] BIGINT NOT NULL,
    [Icd10Code] VARCHAR(255),
    [Description] VARCHAR(255),
    [IsCode] VARCHAR(255),
    CONSTRAINT [PK__icd10__339E70727DFF20B0] PRIMARY KEY CLUSTERED ([Icd10Num]),
    CONSTRAINT [UQ__icd10__EB50CEE89F49E72E] UNIQUE NONCLUSTERED ([Icd10Code])
);

-- CreateTable
CREATE TABLE [dbo].[icd9] (
    [ICD9Num] BIGINT NOT NULL,
    [ICD9Code] VARCHAR(255),
    [Description] VARCHAR(255),
    [DateTStamp] DATETIME2,
    CONSTRAINT [PK__icd9__538B1136656D2371] PRIMARY KEY CLUSTERED ([ICD9Num]),
    CONSTRAINT [UQ__icd9__7B5EDC8115AC2E6D] UNIQUE NONCLUSTERED ([ICD9Code])
);

-- CreateTable
CREATE TABLE [dbo].[imagedraw] (
    [ImageDrawNum] BIGINT NOT NULL,
    [DocNum] BIGINT,
    [MountNum] BIGINT,
    [ColorDraw] INT,
    [ColorBack] INT,
    [DrawingSegment] TEXT,
    [DrawText] VARCHAR(255),
    [FontSize] FLOAT(53),
    [DrawType] INT,
    [ImageAnnotVendor] INT,
    [Details] TEXT,
    [PearlLayer] INT,
    [BetterDiagLayer] INT,
    CONSTRAINT [PK__imagedra__B881F04182FBEC40] PRIMARY KEY CLUSTERED ([ImageDrawNum])
);

-- CreateTable
CREATE TABLE [dbo].[imagingdevice] (
    [ImagingDeviceNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ComputerName] VARCHAR(255),
    [DeviceType] INT,
    [TwainName] VARCHAR(255),
    [ItemOrder] INT,
    [ShowTwainUI] INT,
    CONSTRAINT [PK__imagingd__C5B49F19C9CA7653] PRIMARY KEY CLUSTERED ([ImagingDeviceNum])
);

-- CreateTable
CREATE TABLE [dbo].[insbluebook] (
    [InsBlueBookNum] BIGINT NOT NULL,
    [ProcCodeNum] BIGINT,
    [CarrierNum] BIGINT,
    [PlanNum] BIGINT,
    [GroupNum] VARCHAR(25),
    [InsPayAmt] FLOAT(53),
    [AllowedOverride] FLOAT(53),
    [DateTEntry] DATETIME2,
    [ProcNum] BIGINT,
    [ProcDate] DATE,
    [ClaimType] VARCHAR(10),
    [ClaimNum] BIGINT,
    CONSTRAINT [PK__insblueb__71C0A14DB8918145] PRIMARY KEY CLUSTERED ([InsBlueBookNum])
);

-- CreateTable
CREATE TABLE [dbo].[insbluebooklog] (
    [InsBlueBookLogNum] BIGINT NOT NULL,
    [ClaimProcNum] BIGINT,
    [AllowedFee] FLOAT(53),
    [DateTEntry] DATETIME2,
    [Description] TEXT,
    CONSTRAINT [PK__insblueb__0554A35F0170A307] PRIMARY KEY CLUSTERED ([InsBlueBookLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[insbluebookrule] (
    [InsBlueBookRuleNum] BIGINT NOT NULL,
    [ItemOrder] SMALLINT,
    [RuleType] INT,
    [LimitValue] INT,
    [LimitType] INT,
    CONSTRAINT [PK__insblueb__574A29DDB08BDAC3] PRIMARY KEY CLUSTERED ([InsBlueBookRuleNum])
);

-- CreateTable
CREATE TABLE [dbo].[inseditlog] (
    [InsEditLogNum] BIGINT NOT NULL,
    [FKey] BIGINT,
    [LogType] INT,
    [FieldName] VARCHAR(255),
    [OldValue] VARCHAR(255),
    [NewValue] VARCHAR(255),
    [UserNum] BIGINT,
    [DateTStamp] DATETIME2,
    [ParentKey] BIGINT,
    [Description] VARCHAR(255),
    CONSTRAINT [PK__inseditl__2A068881F6F7F27F] PRIMARY KEY CLUSTERED ([InsEditLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[inseditpatlog] (
    [InsEditPatLogNum] BIGINT NOT NULL,
    [FKey] BIGINT,
    [LogType] INT,
    [FieldName] VARCHAR(255),
    [OldValue] VARCHAR(255),
    [NewValue] VARCHAR(255),
    [UserNum] BIGINT,
    [DateTStamp] DATETIME2,
    [ParentKey] BIGINT,
    [Description] VARCHAR(255),
    CONSTRAINT [PK__inseditp__209A355242317F0C] PRIMARY KEY CLUSTERED ([InsEditPatLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[insfilingcode] (
    [InsFilingCodeNum] BIGINT NOT NULL,
    [Descript] VARCHAR(255),
    [EclaimCode] VARCHAR(100),
    [ItemOrder] INT,
    [GroupType] BIGINT,
    [ExcludeOtherCoverageOnPriClaims] INT,
    CONSTRAINT [PK__insfilin__76FDA248AF135773] PRIMARY KEY CLUSTERED ([InsFilingCodeNum])
);

-- CreateTable
CREATE TABLE [dbo].[insfilingcodesubtype] (
    [InsFilingCodeSubtypeNum] BIGINT NOT NULL,
    [InsFilingCodeNum] BIGINT,
    [Descript] VARCHAR(255),
    CONSTRAINT [PK__insfilin__7189607B53A43F0E] PRIMARY KEY CLUSTERED ([InsFilingCodeSubtypeNum])
);

-- CreateTable
CREATE TABLE [dbo].[inspending] (
    [InsPendingNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [PatNumSubscriber] BIGINT,
    [Ordinal] INT,
    [Relationship] INT,
    [GroupNum] VARCHAR(255),
    [GroupName] VARCHAR(255),
    [Employer] VARCHAR(255),
    [SubscriberID] VARCHAR(255),
    [Phone] VARCHAR(255),
    [CarrierName] VARCHAR(255),
    CONSTRAINT [PK__inspendi__80EC250A9EF74528] PRIMARY KEY CLUSTERED ([InsPendingNum])
);

-- CreateTable
CREATE TABLE [dbo].[insplan] (
    [PlanNum] BIGINT NOT NULL,
    [GroupName] VARCHAR(50),
    [GroupNum] VARCHAR(50),
    [PlanNote] TEXT,
    [FeeSched] BIGINT,
    [PlanType] CHAR(1),
    [ClaimFormNum] BIGINT,
    [UseAltCode] INT,
    [ClaimsUseUCR] INT,
    [CopayFeeSched] BIGINT,
    [EmployerNum] BIGINT,
    [CarrierNum] BIGINT,
    [AllowedFeeSched] BIGINT,
    [TrojanID] VARCHAR(100),
    [DivisionNo] VARCHAR(255),
    [IsMedical] INT,
    [FilingCode] BIGINT,
    [DentaideCardSequence] INT,
    [ShowBaseUnits] INT,
    [CodeSubstNone] INT,
    [IsHidden] INT,
    [MonthRenew] INT,
    [FilingCodeSubtype] BIGINT,
    [CanadianPlanFlag] VARCHAR(5),
    [CanadianDiagnosticCode] VARCHAR(255),
    [CanadianInstitutionCode] VARCHAR(255),
    [RxBIN] VARCHAR(255),
    [CobRule] INT,
    [SopCode] VARCHAR(255),
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    [HideFromVerifyList] INT,
    [OrthoType] INT,
    [OrthoAutoProcFreq] INT,
    [OrthoAutoProcCodeNumOverride] BIGINT,
    [OrthoAutoFeeBilled] FLOAT(53),
    [OrthoAutoClaimDaysWait] INT,
    [BillingType] BIGINT,
    [HasPpoSubstWriteoffs] INT,
    [ExclusionFeeRule] INT,
    [ManualFeeSchedNum] BIGINT,
    [IsBlueBookEnabled] INT,
    [InsPlansZeroWriteOffsOnAnnualMaxOverride] INT,
    [InsPlansZeroWriteOffsOnFreqOrAgingOverride] INT,
    [PerVisitPatAmount] FLOAT(53),
    [PerVisitInsAmount] FLOAT(53),
    CONSTRAINT [PK__insplan__B0F5CAE9333F4C8C] PRIMARY KEY CLUSTERED ([PlanNum])
);

-- CreateTable
CREATE TABLE [dbo].[insplanpreference] (
    [InsPlanPrefNum] BIGINT NOT NULL,
    [PlanNum] BIGINT,
    [FKey] BIGINT,
    [FKeyType] INT,
    [ValueString] TEXT,
    CONSTRAINT [PK__insplanp__E86B43E7B9830758] PRIMARY KEY CLUSTERED ([InsPlanPrefNum])
);

-- CreateTable
CREATE TABLE [dbo].[inssub] (
    [InsSubNum] BIGINT NOT NULL,
    [PlanNum] BIGINT,
    [Subscriber] BIGINT,
    [DateEffective] DATE,
    [DateTerm] DATE,
    [ReleaseInfo] INT,
    [AssignBen] INT,
    [SubscriberID] VARCHAR(255),
    [BenefitNotes] TEXT,
    [SubscNote] TEXT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    [SecurityHash] VARCHAR(255),
    CONSTRAINT [PK__inssub__60F3D93ABC00A122] PRIMARY KEY CLUSTERED ([InsSubNum])
);

-- CreateTable
CREATE TABLE [dbo].[installmentplan] (
    [InstallmentPlanNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateAgreement] DATE,
    [DateFirstPayment] DATE,
    [MonthlyPayment] FLOAT(53),
    [APR] FLOAT(53),
    [Note] VARCHAR(255),
    CONSTRAINT [PK__installm__1E9A4EBD2DEE094C] PRIMARY KEY CLUSTERED ([InstallmentPlanNum])
);

-- CreateTable
CREATE TABLE [dbo].[insverify] (
    [InsVerifyNum] BIGINT NOT NULL,
    [DateLastVerified] DATE,
    [UserNum] BIGINT,
    [VerifyType] INT,
    [FKey] BIGINT,
    [DefNum] BIGINT,
    [Note] TEXT,
    [DateLastAssigned] DATE,
    [DateTimeEntry] DATETIME2,
    [HoursAvailableForVerification] FLOAT(53),
    [SecDateTEdit] DATETIME2,
    [SecurityHash] VARCHAR(255),
    CONSTRAINT [PK__insverif__04D8571E793C8D62] PRIMARY KEY CLUSTERED ([InsVerifyNum])
);

-- CreateTable
CREATE TABLE [dbo].[insverifyhist] (
    [InsVerifyHistNum] BIGINT NOT NULL,
    [InsVerifyNum] BIGINT,
    [DateLastVerified] DATE,
    [UserNum] BIGINT,
    [VerifyType] INT,
    [FKey] BIGINT,
    [DefNum] BIGINT,
    [Note] TEXT,
    [DateLastAssigned] DATE,
    [DateTimeEntry] DATETIME2,
    [HoursAvailableForVerification] FLOAT(53),
    [VerifyUserNum] BIGINT,
    [SecDateTEdit] DATETIME2,
    [SecurityHash] VARCHAR(255),
    CONSTRAINT [PK__insverif__9BBE358A2C1A5542] PRIMARY KEY CLUSTERED ([InsVerifyHistNum])
);

-- CreateTable
CREATE TABLE [dbo].[intervention] (
    [InterventionNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ProvNum] BIGINT,
    [CodeValue] VARCHAR(30),
    [CodeSystem] VARCHAR(255),
    [Note] TEXT,
    [DateEntry] DATE,
    [CodeSet] INT,
    [IsPatDeclined] INT,
    CONSTRAINT [PK__interven__2A1EEAE57B6733FC] PRIMARY KEY CLUSTERED ([InterventionNum])
);

-- CreateTable
CREATE TABLE [dbo].[journalentry] (
    [JournalEntryNum] BIGINT NOT NULL,
    [TransactionNum] BIGINT,
    [AccountNum] BIGINT,
    [DateDisplayed] DATE,
    [DebitAmt] FLOAT(53),
    [CreditAmt] FLOAT(53),
    [Memo] TEXT,
    [Splits] TEXT,
    [CheckNumber] VARCHAR(255),
    [ReconcileNum] BIGINT,
    [SecUserNumEntry] BIGINT,
    [SecDateTEntry] DATETIME2,
    [SecUserNumEdit] BIGINT,
    [SecDateTEdit] DATETIME2,
    [Payee] VARCHAR(255),
    [Notes] TEXT,
    CONSTRAINT [PK__journale__84B94C76988D6DEF] PRIMARY KEY CLUSTERED ([JournalEntryNum])
);

-- CreateTable
CREATE TABLE [dbo].[labcase] (
    [LabCaseNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [LaboratoryNum] BIGINT,
    [AptNum] BIGINT,
    [PlannedAptNum] BIGINT,
    [DateTimeDue] DATETIME2,
    [DateTimeCreated] DATETIME2,
    [DateTimeSent] DATETIME2,
    [DateTimeRecd] DATETIME2,
    [DateTimeChecked] DATETIME2,
    [ProvNum] BIGINT,
    [Instructions] TEXT,
    [LabFee] FLOAT(53),
    [DateTStamp] DATETIME2,
    [InvoiceNum] VARCHAR(255),
    CONSTRAINT [PK__labcase__F08B34F474214521] PRIMARY KEY CLUSTERED ([LabCaseNum])
);

-- CreateTable
CREATE TABLE [dbo].[laboratory] (
    [LaboratoryNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [Phone] VARCHAR(255),
    [Notes] TEXT,
    [Slip] BIGINT,
    [Address] VARCHAR(255),
    [City] VARCHAR(255),
    [State] VARCHAR(255),
    [Zip] VARCHAR(255),
    [Email] VARCHAR(255),
    [WirelessPhone] VARCHAR(255),
    [IsHidden] INT,
    CONSTRAINT [PK__laborato__A0C44E13E0FF92ED] PRIMARY KEY CLUSTERED ([LaboratoryNum])
);

-- CreateTable
CREATE TABLE [dbo].[labpanel] (
    [LabPanelNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [RawMessage] TEXT,
    [LabNameAddress] VARCHAR(255),
    [DateTStamp] DATETIME2,
    [SpecimenCondition] VARCHAR(255),
    [SpecimenSource] VARCHAR(255),
    [ServiceId] VARCHAR(255),
    [ServiceName] VARCHAR(255),
    [MedicalOrderNum] BIGINT,
    CONSTRAINT [PK__labpanel__07F0D8B517BFD705] PRIMARY KEY CLUSTERED ([LabPanelNum])
);

-- CreateTable
CREATE TABLE [dbo].[labresult] (
    [LabResultNum] BIGINT NOT NULL,
    [LabPanelNum] BIGINT,
    [DateTimeTest] DATETIME2,
    [TestName] VARCHAR(255),
    [DateTStamp] DATETIME2,
    [TestID] VARCHAR(255),
    [ObsValue] VARCHAR(255),
    [ObsUnits] VARCHAR(255),
    [ObsRange] VARCHAR(255),
    [AbnormalFlag] INT,
    CONSTRAINT [PK__labresul__30F89CE6C3216129] PRIMARY KEY CLUSTERED ([LabResultNum]),
    CONSTRAINT [UQ__labresul__8CC3310121AEF320] UNIQUE NONCLUSTERED ([TestID])
);

-- CreateTable
CREATE TABLE [dbo].[labturnaround] (
    [LabTurnaroundNum] BIGINT NOT NULL,
    [LaboratoryNum] BIGINT,
    [Description] VARCHAR(255),
    [DaysPublished] SMALLINT,
    [DaysActual] SMALLINT,
    CONSTRAINT [PK__labturna__70683DEC9EED5066] PRIMARY KEY CLUSTERED ([LabTurnaroundNum])
);

-- CreateTable
CREATE TABLE [dbo].[language] (
    [LanguageNum] BIGINT NOT NULL,
    [EnglishComments] TEXT,
    [ClassType] TEXT,
    [English] TEXT,
    [IsObsolete] INT,
    CONSTRAINT [PK__language__B35BC473397A1D9A] PRIMARY KEY CLUSTERED ([LanguageNum])
);

-- CreateTable
CREATE TABLE [dbo].[languageforeign] (
    [LanguageForeignNum] BIGINT NOT NULL,
    [ClassType] TEXT,
    [English] TEXT,
    [Culture] VARCHAR(255),
    [Translation] TEXT,
    [Comments] TEXT,
    CONSTRAINT [PK__language__BCD411A666A5E39B] PRIMARY KEY CLUSTERED ([LanguageForeignNum])
);

-- CreateTable
CREATE TABLE [dbo].[languagepat] (
    [LanguagePatNum] BIGINT NOT NULL,
    [PrefName] VARCHAR(255),
    [Language] VARCHAR(255),
    [Translation] TEXT,
    [EFormFieldDefNum] BIGINT,
    CONSTRAINT [PK__language__AD76DF90CF7EBC52] PRIMARY KEY CLUSTERED ([LanguagePatNum])
);

-- CreateTable
CREATE TABLE [dbo].[letter] (
    [LetterNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [BodyText] TEXT,
    CONSTRAINT [PK__letter__86A049425BB756FB] PRIMARY KEY CLUSTERED ([LetterNum])
);

-- CreateTable
CREATE TABLE [dbo].[lettermerge] (
    [LetterMergeNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [TemplateName] VARCHAR(255),
    [DataFileName] VARCHAR(255),
    [Category] BIGINT,
    [ImageFolder] BIGINT,
    CONSTRAINT [PK__letterme__B6B0E20FCEBBF8BA] PRIMARY KEY CLUSTERED ([LetterMergeNum])
);

-- CreateTable
CREATE TABLE [dbo].[lettermergefield] (
    [FieldNum] BIGINT NOT NULL,
    [LetterMergeNum] BIGINT,
    [FieldName] VARCHAR(255),
    CONSTRAINT [PK__letterme__37F5FB23F1F430CD] PRIMARY KEY CLUSTERED ([FieldNum])
);

-- CreateTable
CREATE TABLE [dbo].[limitedbetafeature] (
    [LimitedBetaFeatureNum] BIGINT,
    [LimitedBetaFeatureTypeNum] BIGINT,
    [ClinicNum] BIGINT,
    [IsSignedUp] INT
);

-- CreateTable
CREATE TABLE [dbo].[loginattempt] (
    [LoginAttemptNum] BIGINT NOT NULL,
    [UserName] VARCHAR(255),
    [LoginType] INT,
    [DateTFail] DATETIME2,
    CONSTRAINT [PK__loginatt__8E5A1F9BE81A1788] PRIMARY KEY CLUSTERED ([LoginAttemptNum])
);

-- CreateTable
CREATE TABLE [dbo].[loinc] (
    [LoincNum] BIGINT NOT NULL,
    [LoincCode] VARCHAR(30),
    [Component] VARCHAR(255),
    [PropertyObserved] VARCHAR(255),
    [TimeAspct] VARCHAR(255),
    [SystemMeasured] VARCHAR(255),
    [ScaleType] VARCHAR(255),
    [MethodType] VARCHAR(255),
    [StatusOfCode] VARCHAR(255),
    [NameShort] VARCHAR(255),
    [ClassType] VARCHAR(255),
    [UnitsRequired] INT,
    [OrderObs] VARCHAR(255),
    [HL7FieldSubfieldID] VARCHAR(255),
    [ExternalCopyrightNotice] TEXT,
    [NameLongCommon] VARCHAR(255),
    [UnitsUCUM] VARCHAR(255),
    [RankCommonTests] INT,
    [RankCommonOrders] INT,
    CONSTRAINT [PK__loinc__1A8C9D50C5A66DB3] PRIMARY KEY CLUSTERED ([LoincNum]),
    CONSTRAINT [UQ__loinc__4EB983902D441133] UNIQUE NONCLUSTERED ([LoincCode])
);

-- CreateTable
CREATE TABLE [dbo].[medicalorder] (
    [MedicalOrderNum] BIGINT NOT NULL,
    [MedOrderType] INT,
    [PatNum] BIGINT,
    [DateTimeOrder] DATETIME2,
    [Description] VARCHAR(255),
    [IsDiscontinued] INT,
    [ProvNum] BIGINT,
    CONSTRAINT [PK__medicalo__E06FF74A90322C10] PRIMARY KEY CLUSTERED ([MedicalOrderNum])
);

-- CreateTable
CREATE TABLE [dbo].[medication] (
    [MedicationNum] BIGINT NOT NULL,
    [MedName] VARCHAR(255),
    [GenericNum] BIGINT,
    [Notes] TEXT,
    [DateTStamp] DATETIME2,
    [RxCui] BIGINT,
    [IsHidden] INT,
    CONSTRAINT [PK__medicati__90DB07CF5FF6B39C] PRIMARY KEY CLUSTERED ([MedicationNum])
);

-- CreateTable
CREATE TABLE [dbo].[medicationpat] (
    [MedicationPatNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [MedicationNum] BIGINT,
    [PatNote] TEXT,
    [DateTStamp] DATETIME2,
    [DateStart] DATE,
    [DateStop] DATE,
    [ProvNum] BIGINT,
    [MedDescript] VARCHAR(255),
    [RxCui] BIGINT,
    [ErxGuid] VARCHAR(255),
    [IsCpoe] INT,
    CONSTRAINT [PK__medicati__2D462E05028B1327] PRIMARY KEY CLUSTERED ([MedicationPatNum])
);

-- CreateTable
CREATE TABLE [dbo].[medlab] (
    [MedLabNum] BIGINT NOT NULL,
    [SendingApp] VARCHAR(255),
    [SendingFacility] VARCHAR(255),
    [PatNum] BIGINT,
    [ProvNum] BIGINT,
    [PatIDLab] VARCHAR(255),
    [PatIDAlt] VARCHAR(255),
    [PatAge] VARCHAR(255),
    [PatAccountNum] VARCHAR(255),
    [PatFasting] INT,
    [SpecimenID] VARCHAR(255),
    [SpecimenIDFiller] VARCHAR(255),
    [ObsTestID] VARCHAR(255),
    [ObsTestDescript] VARCHAR(255),
    [ObsTestLoinc] VARCHAR(255),
    [ObsTestLoincText] VARCHAR(255),
    [DateTimeCollected] DATETIME2,
    [TotalVolume] VARCHAR(255),
    [ActionCode] VARCHAR(255),
    [ClinicalInfo] VARCHAR(255),
    [DateTimeEntered] DATETIME2,
    [OrderingProvNPI] VARCHAR(255),
    [OrderingProvLocalID] VARCHAR(255),
    [OrderingProvLName] VARCHAR(255),
    [OrderingProvFName] VARCHAR(255),
    [SpecimenIDAlt] VARCHAR(255),
    [DateTimeReported] DATETIME2,
    [ResultStatus] VARCHAR(255),
    [ParentObsID] VARCHAR(255),
    [ParentObsTestID] VARCHAR(255),
    [NotePat] TEXT,
    [NoteLab] TEXT,
    [FileName] VARCHAR(255),
    [OriginalPIDSegment] TEXT,
    CONSTRAINT [PK__medlab__07F10CC9B7E6BF8A] PRIMARY KEY CLUSTERED ([MedLabNum]),
    CONSTRAINT [UQ__medlab__11D217A4396FD0F6] UNIQUE NONCLUSTERED ([PatAccountNum])
);

-- CreateTable
CREATE TABLE [dbo].[medlabfacattach] (
    [MedLabFacAttachNum] BIGINT NOT NULL,
    [MedLabNum] BIGINT,
    [MedLabResultNum] BIGINT,
    [MedLabFacilityNum] BIGINT,
    CONSTRAINT [PK__medlabfa__E47951B79FE18206] PRIMARY KEY CLUSTERED ([MedLabFacAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[medlabfacility] (
    [MedLabFacilityNum] BIGINT NOT NULL,
    [FacilityName] VARCHAR(255),
    [Address] VARCHAR(255),
    [City] VARCHAR(255),
    [State] VARCHAR(255),
    [Zip] VARCHAR(255),
    [Phone] VARCHAR(255),
    [DirectorTitle] VARCHAR(255),
    [DirectorLName] VARCHAR(255),
    [DirectorFName] VARCHAR(255),
    CONSTRAINT [PK__medlabfa__6459CA6BFC37E116] PRIMARY KEY CLUSTERED ([MedLabFacilityNum])
);

-- CreateTable
CREATE TABLE [dbo].[medlabresult] (
    [MedLabResultNum] BIGINT NOT NULL,
    [MedLabNum] BIGINT,
    [ObsID] VARCHAR(255),
    [ObsText] VARCHAR(255),
    [ObsLoinc] VARCHAR(255),
    [ObsLoincText] VARCHAR(255),
    [ObsIDSub] VARCHAR(255),
    [ObsValue] TEXT,
    [ObsSubType] VARCHAR(255),
    [ObsUnits] VARCHAR(255),
    [ReferenceRange] VARCHAR(255),
    [AbnormalFlag] VARCHAR(255),
    [ResultStatus] VARCHAR(255),
    [DateTimeObs] DATETIME2,
    [FacilityID] VARCHAR(255),
    [DocNum] BIGINT,
    [Note] TEXT,
    CONSTRAINT [PK__medlabre__80D4B5691D9DB1F1] PRIMARY KEY CLUSTERED ([MedLabResultNum])
);

-- CreateTable
CREATE TABLE [dbo].[medlabspecimen] (
    [MedLabSpecimenNum] BIGINT NOT NULL,
    [MedLabNum] BIGINT,
    [SpecimenID] VARCHAR(255),
    [SpecimenDescript] VARCHAR(255),
    [DateTimeCollected] DATETIME2,
    CONSTRAINT [PK__medlabsp__8349FCFFCCE9B56B] PRIMARY KEY CLUSTERED ([MedLabSpecimenNum])
);

-- CreateTable
CREATE TABLE [dbo].[mobileappdevice] (
    [MobileAppDeviceNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [DeviceName] VARCHAR(255),
    [UniqueID] VARCHAR(255),
    [IsEclipboardEnabled] INT,
    [EclipboardLastAttempt] DATETIME2,
    [EclipboardLastLogin] DATETIME2,
    [PatNum] BIGINT,
    [LastCheckInActivity] DATETIME2,
    [IsBYODDevice] INT,
    [DevicePage] INT,
    [UserNum] BIGINT,
    [IsODTouchEnabled] INT,
    [ODTouchLastLogin] DATETIME2,
    [ODTouchLastAttempt] DATETIME2,
    CONSTRAINT [PK__mobileap__9A7F51A1775CCE58] PRIMARY KEY CLUSTERED ([MobileAppDeviceNum])
);

-- CreateTable
CREATE TABLE [dbo].[mobilebrandingprofile] (
    [MobileBrandingProfileNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [OfficeDescription] VARCHAR(255),
    [LogoFilePath] VARCHAR(255),
    [DateTStamp] DATETIME2,
    CONSTRAINT [PK__mobilebr__607D728787CDAC12] PRIMARY KEY CLUSTERED ([MobileBrandingProfileNum])
);

-- CreateTable
CREATE TABLE [dbo].[mobiledatabyte] (
    [MobileDataByteNum] BIGINT NOT NULL,
    [RawBase64Data] TEXT,
    [RawBase64Code] TEXT,
    [RawBase64Tag] TEXT,
    [PatNum] BIGINT,
    [ActionType] INT,
    [DateTimeEntry] DATETIME2,
    [DateTimeExpires] DATETIME2,
    CONSTRAINT [PK__mobileda__618DD7666779B423] PRIMARY KEY CLUSTERED ([MobileDataByteNum])
);

-- CreateTable
CREATE TABLE [dbo].[mobilenotification] (
    [MobileNotificationNum] BIGINT NOT NULL,
    [NotificationType] INT,
    [DeviceId] VARCHAR(255),
    [PrimaryKeys] TEXT,
    [Tags] TEXT,
    [DateTimeEntry] DATETIME2,
    [DateTimeExpires] DATETIME2,
    [AppTarget] INT,
    CONSTRAINT [PK__mobileno__990DC0874A977852] PRIMARY KEY CLUSTERED ([MobileNotificationNum])
);

-- CreateTable
CREATE TABLE [dbo].[mount] (
    [MountNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DocCategory] BIGINT,
    [DateCreated] DATETIME2,
    [Description] VARCHAR(255),
    [Note] TEXT,
    [Width] INT,
    [Height] INT,
    [ColorBack] INT,
    [ProvNum] BIGINT,
    [ColorFore] INT,
    [ColorTextBack] INT,
    [FlipOnAcquire] INT,
    [AdjModeAfterSeries] INT,
    CONSTRAINT [PK__mount__35694CEDFCF9C966] PRIMARY KEY CLUSTERED ([MountNum])
);

-- CreateTable
CREATE TABLE [dbo].[mountdef] (
    [MountDefNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ItemOrder] INT,
    [Width] INT,
    [Height] INT,
    [ColorBack] INT,
    [ColorFore] INT,
    [ColorTextBack] INT,
    [ScaleValue] VARCHAR(255),
    [DefaultCat] BIGINT,
    [FlipOnAcquire] INT,
    [AdjModeAfterSeries] INT,
    CONSTRAINT [PK__mountdef__C17E77CCC95BAD5D] PRIMARY KEY CLUSTERED ([MountDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[mountitem] (
    [MountItemNum] BIGINT NOT NULL,
    [MountNum] BIGINT,
    [Xpos] INT,
    [Ypos] INT,
    [ItemOrder] INT,
    [Width] INT,
    [Height] INT,
    [RotateOnAcquire] INT,
    [ToothNumbers] VARCHAR(255),
    [TextShowing] TEXT,
    [FontSize] FLOAT(53),
    CONSTRAINT [PK__mountite__BF583CE747E834A5] PRIMARY KEY CLUSTERED ([MountItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[mountitemdef] (
    [MountItemDefNum] BIGINT NOT NULL,
    [MountDefNum] BIGINT,
    [Xpos] INT,
    [Ypos] INT,
    [Width] INT,
    [Height] INT,
    [ItemOrder] INT,
    [RotateOnAcquire] INT,
    [ToothNumbers] VARCHAR(255),
    [TextShowing] TEXT,
    [FontSize] FLOAT(53),
    CONSTRAINT [PK__mountite__D5CB4BD721AC264E] PRIMARY KEY CLUSTERED ([MountItemDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[msgtopaysent] (
    [MsgToPaySentNum] BIGINT,
    [PatNum] BIGINT,
    [ClinicNum] BIGINT,
    [SendStatus] INT,
    [Source] INT,
    [MessageType] INT,
    [MessageFk] BIGINT,
    [Subject] TEXT,
    [Message] TEXT,
    [EmailType] INT,
    [DateTimeEntry] DATETIME2,
    [DateTimeSent] DATETIME2,
    [ResponseDescript] TEXT,
    [ApptReminderRuleNum] BIGINT,
    [ShortGUID] VARCHAR(255),
    [DateTimeSendFailed] DATETIME2,
    [ApptNum] BIGINT,
    [ApptDateTime] DATETIME2,
    [TSPrior] BIGINT,
    [StatementNum] BIGINT
);

-- CreateTable
CREATE TABLE [dbo].[oidexternal] (
    [OIDExternalNum] BIGINT NOT NULL,
    [IDType] VARCHAR(255),
    [IDInternal] BIGINT,
    [IDExternal] VARCHAR(255),
    [rootExternal] VARCHAR(255),
    CONSTRAINT [PK__oidexter__4FFB3C8DD0F1514C] PRIMARY KEY CLUSTERED ([OIDExternalNum])
);

-- CreateTable
CREATE TABLE [dbo].[oidinternal] (
    [OIDInternalNum] BIGINT NOT NULL,
    [IDType] VARCHAR(255),
    [IDRoot] VARCHAR(255),
    CONSTRAINT [PK__oidinter__6A8D90EDFBE3D33F] PRIMARY KEY CLUSTERED ([OIDInternalNum])
);

-- CreateTable
CREATE TABLE [dbo].[operatory] (
    [OperatoryNum] BIGINT NOT NULL,
    [OpName] VARCHAR(255),
    [Abbrev] VARCHAR(255),
    [ItemOrder] SMALLINT,
    [IsHidden] INT,
    [ProvDentist] BIGINT,
    [ProvHygienist] BIGINT,
    [IsHygiene] INT,
    [ClinicNum] BIGINT,
    [DateTStamp] DATETIME2,
    [SetProspective] INT,
    [IsWebSched] INT,
    [IsNewPatAppt] INT,
    [OperatoryType] BIGINT,
    CONSTRAINT [PK__operator__6DE50BD5EA4AB848] PRIMARY KEY CLUSTERED ([OperatoryNum])
);

-- CreateTable
CREATE TABLE [dbo].[orionproc] (
    [OrionProcNum] BIGINT,
    [ProcNum] BIGINT,
    [DPC] INT,
    [DateScheduleBy] DATE,
    [DateStopClock] DATE,
    [Status2] INT,
    [IsOnCall] INT,
    [IsEffectiveComm] INT,
    [IsRepair] INT,
    [DPCpost] INT
);

-- CreateTable
CREATE TABLE [dbo].[orthocase] (
    [OrthoCaseNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ProvNum] BIGINT,
    [ClinicNum] BIGINT,
    [Fee] FLOAT(53),
    [FeeInsPrimary] FLOAT(53),
    [FeePat] FLOAT(53),
    [BandingDate] DATE,
    [DebondDate] DATE,
    [DebondDateExpected] DATE,
    [IsTransfer] INT,
    [OrthoType] BIGINT,
    [SecDateTEntry] DATETIME2,
    [SecUserNumEntry] BIGINT,
    [SecDateTEdit] DATETIME2,
    [IsActive] INT,
    [FeeInsSecondary] FLOAT(53),
    CONSTRAINT [PK__orthocas__3A33CD651B723B77] PRIMARY KEY CLUSTERED ([OrthoCaseNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthochart] (
    [OrthoChartNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateService] DATE,
    [FieldName] VARCHAR(255),
    [FieldValue] TEXT,
    [UserNum] BIGINT,
    [ProvNum] BIGINT,
    [OrthoChartRowNum] BIGINT,
    CONSTRAINT [PK__orthocha__D4451FFE4494740D] PRIMARY KEY CLUSTERED ([OrthoChartNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthochartlog] (
    [OrthoChartLogNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ComputerName] VARCHAR(255),
    [DateTimeLog] DATETIME2,
    [DateTimeService] DATETIME2,
    [UserNum] BIGINT,
    [ProvNum] BIGINT,
    [OrthoChartRowNum] BIGINT,
    [LogData] TEXT,
    CONSTRAINT [PK__orthocha__B9B768FED1FAE2CC] PRIMARY KEY CLUSTERED ([OrthoChartLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthochartrow] (
    [OrthoChartRowNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateTimeService] DATETIME2,
    [UserNum] BIGINT,
    [ProvNum] BIGINT,
    [Signature] TEXT,
    CONSTRAINT [PK__orthocha__C6C13778F1E42ED0] PRIMARY KEY CLUSTERED ([OrthoChartRowNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthocharttab] (
    [OrthoChartTabNum] BIGINT NOT NULL,
    [TabName] VARCHAR(255),
    [ItemOrder] INT,
    [IsHidden] INT,
    CONSTRAINT [PK__orthocha__F2129AC6ACEE6890] PRIMARY KEY CLUSTERED ([OrthoChartTabNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthocharttablink] (
    [OrthoChartTabLinkNum] BIGINT NOT NULL,
    [ItemOrder] INT,
    [OrthoChartTabNum] BIGINT,
    [DisplayFieldNum] BIGINT,
    [ColumnWidthOverride] INT,
    CONSTRAINT [PK__orthocha__E4A2FB4599D22474] PRIMARY KEY CLUSTERED ([OrthoChartTabLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthohardware] (
    [OrthoHardwareNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateExam] DATE,
    [OrthoHardwareType] INT,
    [OrthoHardwareSpecNum] BIGINT,
    [ToothRange] VARCHAR(255),
    [Note] VARCHAR(255),
    [IsHidden] INT,
    CONSTRAINT [PK__orthohar__75621842778D6096] PRIMARY KEY CLUSTERED ([OrthoHardwareNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthohardwarespec] (
    [OrthoHardwareSpecNum] BIGINT NOT NULL,
    [OrthoHardwareType] INT,
    [Description] VARCHAR(255),
    [ItemColor] INT,
    [IsHidden] INT,
    [ItemOrder] INT,
    CONSTRAINT [PK__orthohar__5088D4F4FC1AC9F2] PRIMARY KEY CLUSTERED ([OrthoHardwareSpecNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthoplanlink] (
    [OrthoPlanLinkNum] BIGINT NOT NULL,
    [OrthoCaseNum] BIGINT,
    [LinkType] INT,
    [FKey] BIGINT,
    [IsActive] INT,
    [SecDateTEntry] DATETIME2,
    [SecUserNumEntry] BIGINT,
    CONSTRAINT [PK__orthopla__FFD1F607374CDDB9] PRIMARY KEY CLUSTERED ([OrthoPlanLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthoproclink] (
    [OrthoProcLinkNum] BIGINT NOT NULL,
    [OrthoCaseNum] BIGINT,
    [ProcNum] BIGINT,
    [SecDateTEntry] DATETIME2,
    [SecUserNumEntry] BIGINT,
    [ProcLinkType] INT,
    CONSTRAINT [PK__orthopro__1EB3A7FA16314EF0] PRIMARY KEY CLUSTERED ([OrthoProcLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthorx] (
    [OrthoRxNum] BIGINT NOT NULL,
    [OrthoHardwareSpecNum] BIGINT,
    [Description] VARCHAR(255),
    [ToothRange] VARCHAR(255),
    [ItemOrder] INT,
    CONSTRAINT [PK__orthorx__2AAACA33D26283DC] PRIMARY KEY CLUSTERED ([OrthoRxNum])
);

-- CreateTable
CREATE TABLE [dbo].[orthoschedule] (
    [OrthoScheduleNum] BIGINT NOT NULL,
    [BandingDateOverride] DATE,
    [DebondDateOverride] DATE,
    [BandingAmount] FLOAT(53),
    [VisitAmount] FLOAT(53),
    [DebondAmount] FLOAT(53),
    [IsActive] INT,
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__orthosch__DA7F32963E1DCD84] PRIMARY KEY CLUSTERED ([OrthoScheduleNum])
);

-- CreateTable
CREATE TABLE [dbo].[patfield] (
    [PatFieldNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [FieldName] VARCHAR(255),
    [FieldValue] TEXT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__patfield__451EF99BD5BFB8CC] PRIMARY KEY CLUSTERED ([PatFieldNum])
);

-- CreateTable
CREATE TABLE [dbo].[patfielddef] (
    [PatFieldDefNum] BIGINT NOT NULL,
    [FieldName] VARCHAR(255),
    [FieldType] INT,
    [PickList] TEXT,
    [ItemOrder] INT,
    [IsHidden] INT,
    CONSTRAINT [PK__patfield__62C605D496C9023D] PRIMARY KEY CLUSTERED ([PatFieldDefNum]),
    CONSTRAINT [UQ__patfield__A88707A61D28F4ED] UNIQUE NONCLUSTERED ([FieldName])
);

-- CreateTable
CREATE TABLE [dbo].[patfieldpickitem] (
    [PatFieldPickItemNum] BIGINT NOT NULL,
    [PatFieldDefNum] BIGINT,
    [Name] VARCHAR(255),
    [Abbreviation] VARCHAR(255),
    [IsHidden] INT,
    [ItemOrder] INT,
    CONSTRAINT [PK__patfield__28C6568808A74AE0] PRIMARY KEY CLUSTERED ([PatFieldPickItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[patient] (
    [PatNum] BIGINT NOT NULL,
    [LName] VARCHAR(100),
    [FName] VARCHAR(100),
    [MiddleI] VARCHAR(100),
    [Preferred] VARCHAR(100),
    [PatStatus] INT,
    [Gender] INT,
    [Position] INT,
    [Birthdate] DATE,
    [SSN] VARCHAR(100),
    [Address] VARCHAR(100),
    [Address2] VARCHAR(100),
    [City] VARCHAR(100),
    [State] VARCHAR(100),
    [Zip] VARCHAR(100),
    [HmPhone] VARCHAR(30),
    [WkPhone] VARCHAR(30),
    [WirelessPhone] VARCHAR(30),
    [Guarantor] BIGINT,
    [CreditType] CHAR(1),
    [Email] VARCHAR(100),
    [Salutation] VARCHAR(100),
    [EstBalance] FLOAT(53),
    [PriProv] BIGINT,
    [SecProv] BIGINT,
    [FeeSched] BIGINT,
    [BillingType] BIGINT,
    [ImageFolder] VARCHAR(100),
    [AddrNote] TEXT,
    [FamFinUrgNote] TEXT,
    [MedUrgNote] VARCHAR(255),
    [ApptModNote] VARCHAR(255),
    [StudentStatus] CHAR(1),
    [SchoolName] VARCHAR(255),
    [ChartNumber] VARCHAR(100),
    [MedicaidID] VARCHAR(20),
    [Bal_0_30] FLOAT(53),
    [Bal_31_60] FLOAT(53),
    [Bal_61_90] FLOAT(53),
    [BalOver90] FLOAT(53),
    [InsEst] FLOAT(53),
    [BalTotal] FLOAT(53),
    [EmployerNum] BIGINT,
    [EmploymentNote] VARCHAR(255),
    [County] VARCHAR(255),
    [GradeLevel] INT,
    [Urgency] INT,
    [DateFirstVisit] DATE,
    [ClinicNum] BIGINT,
    [HasIns] VARCHAR(255),
    [TrophyFolder] VARCHAR(255),
    [PlannedIsDone] INT,
    [Premed] INT,
    [Ward] VARCHAR(255),
    [PreferConfirmMethod] INT,
    [PreferContactMethod] INT,
    [PreferRecallMethod] INT,
    [SchedBeforeTime] TIME,
    [SchedAfterTime] TIME,
    [SchedDayOfWeek] INT,
    [Language] VARCHAR(100),
    [AdmitDate] DATE,
    [Title] VARCHAR(15),
    [PayPlanDue] FLOAT(53),
    [SiteNum] BIGINT,
    [DateTStamp] DATETIME2,
    [ResponsParty] BIGINT,
    [CanadianEligibilityCode] INT,
    [AskToArriveEarly] INT,
    [PreferContactConfidential] INT,
    [SuperFamily] BIGINT,
    [TxtMsgOk] INT,
    [SmokingSnoMed] VARCHAR(32),
    [Country] VARCHAR(255),
    [DateTimeDeceased] DATETIME2,
    [BillingCycleDay] INT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [HasSuperBilling] INT,
    [PatNumCloneFrom] BIGINT,
    [DiscountPlanNum] BIGINT,
    [HasSignedTil] INT,
    [ShortCodeOptIn] INT,
    [SecurityHash] VARCHAR(255),
    CONSTRAINT [PK__patient__B32F7704D5070182] PRIMARY KEY CLUSTERED ([PatNum])
);

-- CreateTable
CREATE TABLE [dbo].[patientlink] (
    [PatientLinkNum] BIGINT NOT NULL,
    [PatNumFrom] BIGINT,
    [PatNumTo] BIGINT,
    [LinkType] INT,
    [DateTimeLink] DATETIME2,
    CONSTRAINT [PK__patientl__55D651514C3CEBC8] PRIMARY KEY CLUSTERED ([PatientLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[patientnote] (
    [PatNum] BIGINT,
    [FamFinancial] TEXT,
    [ApptPhone] TEXT,
    [Medical] TEXT,
    [Service] TEXT,
    [MedicalComp] TEXT,
    [Treatment] TEXT,
    [ICEName] VARCHAR(255),
    [ICEPhone] VARCHAR(30),
    [OrthoMonthsTreatOverride] INT,
    [DateOrthoPlacementOverride] DATE,
    [SecDateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    [Consent] INT,
    [UserNumOrthoLocked] BIGINT,
    [Pronoun] INT
);

-- CreateTable
CREATE TABLE [dbo].[patientportalinvite] (
    [PatientPortalInviteNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ApptNum] BIGINT,
    [ClinicNum] BIGINT,
    [DateTimeEntry] DATETIME2,
    [TSPrior] BIGINT,
    [SendStatus] INT,
    [MessageFk] BIGINT,
    [ResponseDescript] TEXT,
    [MessageType] INT,
    [DateTimeSent] DATETIME2,
    [ApptReminderRuleNum] BIGINT,
    [ApptDateTime] DATETIME2,
    CONSTRAINT [PK__patientp__531E900177428F3F] PRIMARY KEY CLUSTERED ([PatientPortalInviteNum])
);

-- CreateTable
CREATE TABLE [dbo].[patientrace] (
    [PatientRaceNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [Race] INT,
    [CdcrecCode] VARCHAR(255),
    CONSTRAINT [PK__patientr__2569FF71D2F444C7] PRIMARY KEY CLUSTERED ([PatientRaceNum])
);

-- CreateTable
CREATE TABLE [dbo].[patplan] (
    [PatPlanNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [Ordinal] INT,
    [IsPending] INT,
    [Relationship] INT,
    [PatID] VARCHAR(100),
    [InsSubNum] BIGINT,
    [OrthoAutoFeeBilledOverride] FLOAT(53),
    [OrthoAutoNextClaimDate] DATE,
    [SecDateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__patplan__DE1E87E7E84C861D] PRIMARY KEY CLUSTERED ([PatPlanNum])
);

-- CreateTable
CREATE TABLE [dbo].[patrestriction] (
    [PatRestrictionNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [PatRestrictType] INT,
    CONSTRAINT [PK__patrestr__7523C6AFA5D99FA3] PRIMARY KEY CLUSTERED ([PatRestrictionNum])
);

-- CreateTable
CREATE TABLE [dbo].[payconnectresponseweb] (
    [PayConnectResponseWebNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [PayNum] BIGINT,
    [AccountToken] VARCHAR(255),
    [PaymentToken] VARCHAR(255),
    [ProcessingStatus] VARCHAR(255),
    [DateTimeEntry] DATETIME2,
    [DateTimePending] DATETIME2,
    [DateTimeCompleted] DATETIME2,
    [DateTimeExpired] DATETIME2,
    [DateTimeLastError] DATETIME2,
    [LastResponseStr] TEXT,
    [CCSource] INT,
    [Amount] FLOAT(53),
    [PayNote] VARCHAR(255),
    [IsTokenSaved] INT,
    [PayToken] VARCHAR(255),
    [ExpDateToken] VARCHAR(255),
    [RefNumber] VARCHAR(255),
    [TransType] VARCHAR(255),
    [EmailResponse] VARCHAR(255),
    [LogGuid] VARCHAR(36),
    CONSTRAINT [PK__payconne__9F65AFAAB2C78676] PRIMARY KEY CLUSTERED ([PayConnectResponseWebNum])
);

-- CreateTable
CREATE TABLE [dbo].[payment] (
    [PayNum] BIGINT NOT NULL,
    [PayType] BIGINT,
    [PayDate] DATE,
    [PayAmt] FLOAT(53),
    [CheckNum] VARCHAR(25),
    [BankBranch] VARCHAR(25),
    [PayNote] TEXT,
    [IsSplit] INT,
    [PatNum] BIGINT,
    [ClinicNum] BIGINT,
    [DateEntry] DATE,
    [DepositNum] BIGINT,
    [Receipt] TEXT,
    [IsRecurringCC] INT,
    [SecUserNumEntry] BIGINT,
    [SecDateTEdit] DATETIME2,
    [PaymentSource] INT,
    [ProcessStatus] INT,
    [RecurringChargeDate] DATE,
    [ExternalId] VARCHAR(255),
    [PaymentStatus] INT,
    [IsCcCompleted] INT,
    [MerchantFee] FLOAT(53),
    CONSTRAINT [PK__payment__68B1D1ABAC1DACD4] PRIMARY KEY CLUSTERED ([PayNum])
);

-- CreateTable
CREATE TABLE [dbo].[payortype] (
    [PayorTypeNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateStart] DATE,
    [SopCode] VARCHAR(255),
    [Note] TEXT,
    CONSTRAINT [PK__payortyp__F96891057092A034] PRIMARY KEY CLUSTERED ([PayorTypeNum])
);

-- CreateTable
CREATE TABLE [dbo].[payperiod] (
    [PayPeriodNum] BIGINT NOT NULL,
    [DateStart] DATE,
    [DateStop] DATE,
    [DatePaycheck] DATE,
    CONSTRAINT [PK__payperio__C8C2E5A95B122F65] PRIMARY KEY CLUSTERED ([PayPeriodNum])
);

-- CreateTable
CREATE TABLE [dbo].[payplan] (
    [PayPlanNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [Guarantor] BIGINT,
    [PayPlanDate] DATE,
    [APR] FLOAT(53),
    [Note] TEXT,
    [PlanNum] BIGINT,
    [CompletedAmt] FLOAT(53),
    [InsSubNum] BIGINT,
    [PaySchedule] INT,
    [NumberOfPayments] INT,
    [PayAmt] FLOAT(53),
    [DownPayment] FLOAT(53),
    [IsClosed] INT,
    [Signature] TEXT,
    [SigIsTopaz] INT,
    [PlanCategory] BIGINT,
    [IsDynamic] INT,
    [ChargeFrequency] INT,
    [DatePayPlanStart] DATE,
    [IsLocked] INT,
    [DateInterestStart] DATE,
    [DynamicPayPlanTPOption] INT,
    [MobileAppDeviceNum] BIGINT,
    [SecurityHash] VARCHAR(255),
    [SheetDefNum] BIGINT,
    CONSTRAINT [PK__payplan__8398F727C78244E6] PRIMARY KEY CLUSTERED ([PayPlanNum])
);

-- CreateTable
CREATE TABLE [dbo].[payplancharge] (
    [PayPlanChargeNum] BIGINT NOT NULL,
    [PayPlanNum] BIGINT,
    [Guarantor] BIGINT,
    [PatNum] BIGINT,
    [ChargeDate] DATE,
    [Principal] FLOAT(53),
    [Interest] FLOAT(53),
    [Note] TEXT,
    [ProvNum] BIGINT,
    [ClinicNum] BIGINT,
    [ChargeType] INT,
    [ProcNum] BIGINT,
    [SecDateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    [StatementNum] BIGINT,
    [FKey] BIGINT,
    [LinkType] INT,
    [IsOffset] INT,
    [IsDownPayment] INT,
    CONSTRAINT [PK__payplanc__4132D787153541F1] PRIMARY KEY CLUSTERED ([PayPlanChargeNum])
);

-- CreateTable
CREATE TABLE [dbo].[payplanlink] (
    [PayPlanLinkNum] BIGINT NOT NULL,
    [PayPlanNum] BIGINT,
    [LinkType] INT,
    [FKey] BIGINT,
    [AmountOverride] FLOAT(53),
    [SecDateTEntry] DATETIME2,
    CONSTRAINT [PK__payplanl__23BEA405CEC6DFA1] PRIMARY KEY CLUSTERED ([PayPlanLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[payplantemplate] (
    [PayPlanTemplateNum] BIGINT NOT NULL,
    [PayPlanTemplateName] VARCHAR(255),
    [ClinicNum] BIGINT,
    [APR] FLOAT(53),
    [InterestDelay] INT,
    [PayAmt] FLOAT(53),
    [NumberOfPayments] INT,
    [ChargeFrequency] INT,
    [DownPayment] FLOAT(53),
    [DynamicPayPlanTPOption] INT,
    [Note] VARCHAR(255),
    [IsHidden] INT,
    [SheetDefNum] BIGINT,
    CONSTRAINT [PK__payplant__F3CAE1322E70F9B4] PRIMARY KEY CLUSTERED ([PayPlanTemplateNum])
);

-- CreateTable
CREATE TABLE [dbo].[paysplit] (
    [SplitNum] BIGINT NOT NULL,
    [SplitAmt] FLOAT(53),
    [PatNum] BIGINT,
    [ProcDate] DATE,
    [PayNum] BIGINT,
    [IsDiscount] INT,
    [DiscountType] INT,
    [ProvNum] BIGINT,
    [PayPlanNum] BIGINT,
    [DatePay] DATE,
    [ProcNum] BIGINT,
    [DateEntry] DATE,
    [UnearnedType] BIGINT,
    [ClinicNum] BIGINT,
    [SecUserNumEntry] BIGINT,
    [SecDateTEdit] DATETIME2,
    [FSplitNum] BIGINT,
    [AdjNum] BIGINT,
    [PayPlanChargeNum] BIGINT,
    [PayPlanDebitType] INT,
    [SecurityHash] VARCHAR(255),
    CONSTRAINT [PK__paysplit__E27D6CC5B1C79B27] PRIMARY KEY CLUSTERED ([SplitNum])
);

-- CreateTable
CREATE TABLE [dbo].[paysuitepayment] (
    [PaySuitePaymentNum] BIGINT NOT NULL,
    [PaymentId] VARCHAR(255),
    [ProviderId] VARCHAR(255),
    [PaymentMethod] VARCHAR(255),
    [PaymentReference] VARCHAR(255),
    [PaymentAmount] FLOAT(53),
    [PaymentDate] DATE,
    [PaymentStatus] VARCHAR(255),
    [ReversalReasonCode] VARCHAR(255),
    [AssociatedPaymentId] VARCHAR(255),
    [PaySuitePaymentDetailNum] BIGINT,
    [HasUnresolvedClaimPayment] INT,
    [ReconciliationStatus] INT,
    [ClaimPaymentNum] BIGINT,
    CONSTRAINT [PK__paysuite__F0B0DBA2B6B64F5B] PRIMARY KEY CLUSTERED ([PaySuitePaymentNum])
);

-- CreateTable
CREATE TABLE [dbo].[paysuitepaymentdetail] (
    [PaySuitePaymentDetailNum] BIGINT NOT NULL,
    [DetailsJson] TEXT,
    CONSTRAINT [PK__paysuite__66073897AE1D7DDF] PRIMARY KEY CLUSTERED ([PaySuitePaymentDetailNum])
);

-- CreateTable
CREATE TABLE [dbo].[payterminal] (
    [PayTerminalNum] BIGINT NOT NULL,
    [Name] VARCHAR(255),
    [ClinicNum] BIGINT,
    [TerminalID] VARCHAR(255),
    [CCIntegration] VARCHAR(50),
    CONSTRAINT [PK__paytermi__6515B06C0C8C3AA4] PRIMARY KEY CLUSTERED ([PayTerminalNum])
);

-- CreateTable
CREATE TABLE [dbo].[pearlrequest] (
    [PearlRequestNum] BIGINT NOT NULL,
    [RequestId] VARCHAR(255),
    [DocNum] BIGINT,
    [RequestStatus] INT,
    [DateTSent] DATE,
    [DateTChecked] DATE,
    CONSTRAINT [PK__pearlreq__7FB4352EEFD279DA] PRIMARY KEY CLUSTERED ([PearlRequestNum])
);

-- CreateTable
CREATE TABLE [dbo].[perioexam] (
    [PerioExamNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ExamDate] DATE,
    [ProvNum] BIGINT,
    [DateTMeasureEdit] DATETIME2,
    [Note] TEXT,
    CONSTRAINT [PK__perioexa__2E7ED1DC773F327F] PRIMARY KEY CLUSTERED ([PerioExamNum])
);

-- CreateTable
CREATE TABLE [dbo].[periomeasure] (
    [PerioMeasureNum] BIGINT NOT NULL,
    [PerioExamNum] BIGINT,
    [SequenceType] INT,
    [IntTooth] SMALLINT,
    [ToothValue] SMALLINT,
    [MBvalue] SMALLINT,
    [Bvalue] SMALLINT,
    [DBvalue] SMALLINT,
    [MLvalue] SMALLINT,
    [Lvalue] SMALLINT,
    [DLvalue] SMALLINT,
    [SecDateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__periomea__9A9F11A72B8E00E9] PRIMARY KEY CLUSTERED ([PerioMeasureNum])
);

-- CreateTable
CREATE TABLE [dbo].[pharmacy] (
    [PharmacyNum] BIGINT NOT NULL,
    [PharmID] VARCHAR(255),
    [StoreName] VARCHAR(255),
    [Phone] VARCHAR(255),
    [Fax] VARCHAR(255),
    [Address] VARCHAR(255),
    [Address2] VARCHAR(255),
    [City] VARCHAR(255),
    [State] VARCHAR(255),
    [Zip] VARCHAR(255),
    [Note] TEXT,
    [DateTStamp] DATETIME2,
    CONSTRAINT [PK__pharmacy__731EA3141EE3D955] PRIMARY KEY CLUSTERED ([PharmacyNum])
);

-- CreateTable
CREATE TABLE [dbo].[pharmclinic] (
    [PharmClinicNum] BIGINT NOT NULL,
    [PharmacyNum] BIGINT,
    [ClinicNum] BIGINT,
    CONSTRAINT [PK__pharmcli__F6851172FF0F08EA] PRIMARY KEY CLUSTERED ([PharmClinicNum])
);

-- CreateTable
CREATE TABLE [dbo].[phonenumber] (
    [PhoneNumberNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [PhoneNumberVal] VARCHAR(255),
    [PhoneNumberDigits] VARCHAR(30),
    [PhoneType] INT,
    CONSTRAINT [PK__phonenum__F51EF994B6E1960A] PRIMARY KEY CLUSTERED ([PhoneNumberNum])
);

-- CreateTable
CREATE TABLE [dbo].[popup] (
    [PopupNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [Description] TEXT,
    [IsDisabled] INT,
    [PopupLevel] INT,
    [UserNum] BIGINT,
    [DateTimeEntry] DATETIME2,
    [IsArchived] INT,
    [PopupNumArchive] BIGINT,
    [DateTimeDisabled] DATETIME2,
    CONSTRAINT [PK__popup__341962DE1C4B5990] PRIMARY KEY CLUSTERED ([PopupNum])
);

-- CreateTable
CREATE TABLE [dbo].[preference] (
    [PrefName] VARCHAR(255),
    [ValueString] TEXT,
    [PrefNum] BIGINT NOT NULL,
    [Comments] TEXT,
    CONSTRAINT [PK__preferen__0C66662145F7768F] PRIMARY KEY CLUSTERED ([PrefNum])
);

-- CreateTable
CREATE TABLE [dbo].[printer] (
    [PrinterNum] BIGINT NOT NULL,
    [ComputerNum] BIGINT,
    [PrintSit] INT,
    [PrinterName] VARCHAR(255),
    [DisplayPrompt] INT,
    [FileExtension] VARCHAR(255),
    [IsVirtualPrinter] INT,
    CONSTRAINT [PK__printer__80AFCD71CAC302F9] PRIMARY KEY CLUSTERED ([PrinterNum])
);

-- CreateTable
CREATE TABLE [dbo].[procapptcolor] (
    [ProcApptColorNum] BIGINT NOT NULL,
    [CodeRange] VARCHAR(255),
    [ColorText] INT,
    [ShowPreviousDate] INT,
    CONSTRAINT [PK__procappt__2A817B67B70E43CC] PRIMARY KEY CLUSTERED ([ProcApptColorNum])
);

-- CreateTable
CREATE TABLE [dbo].[procbutton] (
    [ProcButtonNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ItemOrder] SMALLINT,
    [Category] BIGINT,
    [ButtonImage] TEXT,
    [IsMultiVisit] INT,
    CONSTRAINT [PK__procbutt__6D4D2743061FDE67] PRIMARY KEY CLUSTERED ([ProcButtonNum])
);

-- CreateTable
CREATE TABLE [dbo].[procbuttonitem] (
    [ProcButtonItemNum] BIGINT NOT NULL,
    [ProcButtonNum] BIGINT,
    [OldCode] VARCHAR(15),
    [AutoCodeNum] BIGINT,
    [CodeNum] BIGINT,
    [ItemOrder] BIGINT,
    CONSTRAINT [PK__procbutt__43AE15C3E5D3923B] PRIMARY KEY CLUSTERED ([ProcButtonItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[procbuttonquick] (
    [ProcButtonQuickNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [CodeValue] VARCHAR(15),
    [Surf] VARCHAR(255),
    [YPos] INT,
    [ItemOrder] INT,
    [IsLabel] INT,
    CONSTRAINT [PK__procbutt__17FB91F0E41DD240] PRIMARY KEY CLUSTERED ([ProcButtonQuickNum])
);

-- CreateTable
CREATE TABLE [dbo].[proccodenote] (
    [ProcCodeNoteNum] BIGINT,
    [CodeNum] BIGINT,
    [ProvNum] BIGINT,
    [Note] TEXT,
    [ProcTime] VARCHAR(255),
    [ProcStatus] INT
);

-- CreateTable
CREATE TABLE [dbo].[procedurecode] (
    [CodeNum] BIGINT,
    [ProcCode] VARCHAR(15) NOT NULL,
    [Descript] VARCHAR(255),
    [AbbrDesc] VARCHAR(50),
    [ProcTime] VARCHAR(24),
    [ProcCat] BIGINT,
    [TreatArea] INT,
    [NoBillIns] INT,
    [IsProsth] INT,
    [DefaultNote] TEXT,
    [IsHygiene] INT,
    [GTypeNum] SMALLINT,
    [AlternateCode1] VARCHAR(15),
    [MedicalCode] VARCHAR(15),
    [IsTaxed] INT,
    [PaintType] INT,
    [GraphicColor] INT,
    [LaymanTerm] VARCHAR(255),
    [IsCanadianLab] INT,
    [PreExisting] INT,
    [BaseUnits] INT,
    [SubstitutionCode] VARCHAR(15),
    [SubstOnlyIf] INT,
    [DateTStamp] DATETIME2,
    [IsMultiVisit] INT,
    [DrugNDC] VARCHAR(255),
    [RevenueCodeDefault] VARCHAR(255),
    [ProvNumDefault] BIGINT,
    [CanadaTimeUnits] FLOAT(53),
    [IsRadiology] INT,
    [DefaultClaimNote] TEXT,
    [DefaultTPNote] TEXT,
    [BypassGlobalLock] INT,
    [TaxCode] VARCHAR(16),
    [PaintText] VARCHAR(255),
    [AreaAlsoToothRange] INT,
    [DiagnosticCodes] VARCHAR(255),
    CONSTRAINT [PK__procedur__C3226A859C197560] PRIMARY KEY CLUSTERED ([ProcCode]),
    CONSTRAINT [UQ__procedur__C6F10454E3BA026F] UNIQUE NONCLUSTERED ([CodeNum])
);

-- CreateTable
CREATE TABLE [dbo].[procedurelog] (
    [ProcNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [AptNum] BIGINT,
    [OldCode] VARCHAR(15),
    [ProcDate] DATE,
    [ProcFee] FLOAT(53),
    [Surf] VARCHAR(10),
    [ToothNum] VARCHAR(2),
    [ToothRange] VARCHAR(100),
    [Priority] BIGINT,
    [ProcStatus] INT,
    [ProvNum] BIGINT,
    [Dx] BIGINT,
    [PlannedAptNum] BIGINT,
    [PlaceService] INT,
    [Prosthesis] CHAR(1),
    [DateOriginalProsth] DATE,
    [ClaimNote] VARCHAR(80),
    [DateEntryC] DATE,
    [ClinicNum] BIGINT,
    [MedicalCode] VARCHAR(15),
    [DiagnosticCode] VARCHAR(255),
    [IsPrincDiag] INT,
    [ProcNumLab] BIGINT,
    [BillingTypeOne] BIGINT,
    [BillingTypeTwo] BIGINT,
    [CodeNum] BIGINT,
    [CodeMod1] CHAR(2),
    [CodeMod2] CHAR(2),
    [CodeMod3] CHAR(2),
    [CodeMod4] CHAR(2),
    [RevCode] VARCHAR(45),
    [UnitQty] INT,
    [BaseUnits] INT,
    [StartTime] INT,
    [StopTime] INT,
    [DateTP] DATE,
    [SiteNum] BIGINT,
    [HideGraphics] INT,
    [CanadianTypeCodes] VARCHAR(20),
    [ProcTime] TIME,
    [ProcTimeEnd] TIME,
    [DateTStamp] DATETIME2,
    [Prognosis] BIGINT,
    [DrugUnit] INT,
    [DrugQty] FLOAT(53),
    [UnitQtyType] INT,
    [StatementNum] BIGINT,
    [IsLocked] INT,
    [BillingNote] VARCHAR(255),
    [RepeatChargeNum] BIGINT,
    [SnomedBodySite] VARCHAR(255),
    [DiagnosticCode2] VARCHAR(255),
    [DiagnosticCode3] VARCHAR(255),
    [DiagnosticCode4] VARCHAR(255),
    [ProvOrderOverride] BIGINT,
    [Discount] FLOAT(53),
    [IsDateProsthEst] INT,
    [IcdVersion] INT,
    [IsCpoe] INT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATETIME2,
    [DateComplete] DATE,
    [OrderingReferralNum] BIGINT,
    [TaxAmt] FLOAT(53),
    [Urgency] INT,
    [DiscountPlanAmt] FLOAT(53),
    [NoBillIns] INT,
    CONSTRAINT [PK__procedur__0AA31E44E8038794] PRIMARY KEY CLUSTERED ([ProcNum])
);

-- CreateTable
CREATE TABLE [dbo].[procgroupitem] (
    [ProcGroupItemNum] BIGINT NOT NULL,
    [ProcNum] BIGINT,
    [GroupNum] BIGINT,
    CONSTRAINT [PK__procgrou__19BA7D2CF04D7A2F] PRIMARY KEY CLUSTERED ([ProcGroupItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[procmultivisit] (
    [ProcMultiVisitNum] BIGINT NOT NULL,
    [GroupProcMultiVisitNum] BIGINT,
    [ProcNum] BIGINT,
    [ProcStatus] INT,
    [IsInProcess] INT,
    [SecDateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    [PatNum] BIGINT,
    CONSTRAINT [PK__procmult__6EDCEB7AE8BDA218] PRIMARY KEY CLUSTERED ([ProcMultiVisitNum])
);

-- CreateTable
CREATE TABLE [dbo].[procnote] (
    [ProcNoteNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ProcNum] BIGINT,
    [EntryDateTime] DATETIME2,
    [UserNum] BIGINT,
    [Note] TEXT,
    [SigIsTopaz] INT,
    [Signature] TEXT,
    CONSTRAINT [PK__procnote__B484FA52E61DF789] PRIMARY KEY CLUSTERED ([ProcNoteNum])
);

-- CreateTable
CREATE TABLE [dbo].[proctp] (
    [ProcTPNum] BIGINT NOT NULL,
    [TreatPlanNum] BIGINT,
    [PatNum] BIGINT,
    [ProcNumOrig] BIGINT,
    [ItemOrder] SMALLINT,
    [Priority] BIGINT,
    [ToothNumTP] VARCHAR(255),
    [Surf] VARCHAR(255),
    [ProcCode] VARCHAR(15),
    [Descript] VARCHAR(255),
    [FeeAmt] FLOAT(53),
    [PriInsAmt] FLOAT(53),
    [SecInsAmt] FLOAT(53),
    [PatAmt] FLOAT(53),
    [Discount] FLOAT(53),
    [Prognosis] VARCHAR(255),
    [Dx] VARCHAR(255),
    [ProcAbbr] VARCHAR(50),
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    [FeeAllowed] FLOAT(53),
    [TaxAmt] FLOAT(53),
    [ProvNum] BIGINT,
    [DateTP] DATE,
    [ClinicNum] BIGINT,
    [CatPercUCR] FLOAT(53),
    CONSTRAINT [PK__proctp__BFD2AD8207732DAA] PRIMARY KEY CLUSTERED ([ProcTPNum])
);

-- CreateTable
CREATE TABLE [dbo].[program] (
    [ProgramNum] BIGINT NOT NULL,
    [ProgName] VARCHAR(100),
    [ProgDesc] VARCHAR(100),
    [Enabled] INT,
    [Path] TEXT,
    [CommandLine] TEXT,
    [Note] TEXT,
    [PluginDllName] VARCHAR(255),
    [ButtonImage] TEXT,
    [FileTemplate] TEXT,
    [FilePath] VARCHAR(255),
    [IsDisabledByHq] INT,
    [CustErr] VARCHAR(255),
    CONSTRAINT [PK__program__9A4C1336772EC60E] PRIMARY KEY CLUSTERED ([ProgramNum])
);

-- CreateTable
CREATE TABLE [dbo].[programproperty] (
    [ProgramPropertyNum] BIGINT NOT NULL,
    [ProgramNum] BIGINT,
    [PropertyDesc] VARCHAR(255),
    [PropertyValue] TEXT,
    [ComputerName] VARCHAR(255),
    [ClinicNum] BIGINT,
    [IsMasked] INT,
    [IsHighSecurity] INT,
    CONSTRAINT [PK__programp__B57778B0453DF182] PRIMARY KEY CLUSTERED ([ProgramPropertyNum])
);

-- CreateTable
CREATE TABLE [dbo].[promotion] (
    [PromotionNum] BIGINT NOT NULL,
    [PromotionName] VARCHAR(255),
    [DateTimeCreated] DATE,
    [ClinicNum] BIGINT,
    [TypePromotion] INT,
    CONSTRAINT [PK__promotio__C6C22EF92A0BBB1B] PRIMARY KEY CLUSTERED ([PromotionNum])
);

-- CreateTable
CREATE TABLE [dbo].[promotionlog] (
    [PromotionLogNum] BIGINT NOT NULL,
    [PromotionNum] BIGINT,
    [PatNum] BIGINT,
    [MessageFk] BIGINT,
    [EmailHostingFK] BIGINT,
    [DateTimeSent] DATETIME2,
    [PromotionStatus] INT,
    [ClinicNum] BIGINT,
    [SendStatus] INT,
    [MessageType] INT,
    [DateTimeEntry] DATETIME2,
    [ResponseDescript] TEXT,
    [ApptReminderRuleNum] BIGINT,
    CONSTRAINT [PK__promotio__A6E1F1C5D5485112] PRIMARY KEY CLUSTERED ([PromotionLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[provider] (
    [ProvNum] BIGINT NOT NULL,
    [Abbr] VARCHAR(255),
    [ItemOrder] SMALLINT,
    [LName] VARCHAR(100),
    [FName] VARCHAR(100),
    [MI] VARCHAR(100),
    [Suffix] VARCHAR(100),
    [FeeSched] BIGINT,
    [Specialty] BIGINT,
    [SSN] VARCHAR(12),
    [StateLicense] VARCHAR(15),
    [DEANum] VARCHAR(15),
    [IsSecondary] INT,
    [ProvColor] INT,
    [IsHidden] INT,
    [UsingTIN] INT,
    [BlueCrossID] VARCHAR(25),
    [SigOnFile] INT,
    [MedicaidID] VARCHAR(20),
    [OutlineColor] INT,
    [SchoolClassNum] BIGINT,
    [NationalProvID] VARCHAR(255),
    [CanadianOfficeNum] VARCHAR(100),
    [DateTStamp] DATETIME2,
    [AnesthProvType] BIGINT,
    [TaxonomyCodeOverride] VARCHAR(255),
    [IsCDAnet] INT,
    [EcwID] VARCHAR(255),
    [StateRxID] VARCHAR(255),
    [IsNotPerson] INT,
    [StateWhereLicensed] VARCHAR(50),
    [EmailAddressNum] BIGINT,
    [IsInstructor] INT,
    [EhrMuStage] INT,
    [ProvNumBillingOverride] BIGINT,
    [CustomID] VARCHAR(255),
    [ProvStatus] INT,
    [IsHiddenReport] INT,
    [IsErxEnabled] INT,
    [Birthdate] DATE,
    [SchedNote] VARCHAR(255),
    [WebSchedDescript] VARCHAR(500),
    [WebSchedImageLocation] VARCHAR(255),
    [HourlyProdGoalAmt] FLOAT(53),
    [DateTerm] DATE,
    [PreferredName] VARCHAR(100),
    CONSTRAINT [PK__provider__2D563DAA20FACC00] PRIMARY KEY CLUSTERED ([ProvNum])
);

-- CreateTable
CREATE TABLE [dbo].[providerclinic] (
    [ProviderClinicNum] BIGINT NOT NULL,
    [ProvNum] BIGINT,
    [ClinicNum] BIGINT,
    [DEANum] VARCHAR(15),
    [StateLicense] VARCHAR(50),
    [StateRxID] VARCHAR(255),
    [StateWhereLicensed] VARCHAR(15),
    [CareCreditMerchantId] VARCHAR(20),
    CONSTRAINT [PK__provider__5BF87A9E2A70EBE9] PRIMARY KEY CLUSTERED ([ProviderClinicNum])
);

-- CreateTable
CREATE TABLE [dbo].[providercliniclink] (
    [ProviderClinicLinkNum] BIGINT NOT NULL,
    [ProvNum] BIGINT,
    [ClinicNum] BIGINT,
    CONSTRAINT [PK__provider__5FFFC647878A87A7] PRIMARY KEY CLUSTERED ([ProviderClinicLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[providererx] (
    [ProviderErxNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [NationalProviderID] VARCHAR(255),
    [IsEnabled] INT,
    [IsIdentifyProofed] INT,
    [IsSentToHq] INT,
    [IsEpcs] INT,
    [ErxType] INT,
    [UserId] VARCHAR(255),
    [AccountId] VARCHAR(25),
    [RegistrationKeyNum] BIGINT,
    CONSTRAINT [PK__provider__FA1F28BA6516156A] PRIMARY KEY CLUSTERED ([ProviderErxNum])
);

-- CreateTable
CREATE TABLE [dbo].[providerident] (
    [ProviderIdentNum] BIGINT NOT NULL,
    [ProvNum] BIGINT,
    [PayorID] VARCHAR(255),
    [SuppIDType] INT,
    [IDNumber] VARCHAR(255),
    CONSTRAINT [PK__provider__D857F58C9C2F8916] PRIMARY KEY CLUSTERED ([ProviderIdentNum])
);

-- CreateTable
CREATE TABLE [dbo].[queryfilter] (
    [QueryFilterNum] BIGINT NOT NULL,
    [GroupName] VARCHAR(255),
    [FilterText] VARCHAR(255),
    CONSTRAINT [PK__queryfil__B9C0D34CCF323520] PRIMARY KEY CLUSTERED ([QueryFilterNum])
);

-- CreateTable
CREATE TABLE [dbo].[question] (
    [QuestionNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ItemOrder] SMALLINT,
    [Description] TEXT,
    [Answer] TEXT,
    [FormPatNum] BIGINT,
    CONSTRAINT [PK__question__CCF13536480F546D] PRIMARY KEY CLUSTERED ([QuestionNum])
);

-- CreateTable
CREATE TABLE [dbo].[questiondef] (
    [QuestionDefNum] BIGINT NOT NULL,
    [Description] TEXT,
    [ItemOrder] SMALLINT,
    [QuestType] INT,
    CONSTRAINT [PK__question__71DB5F3551225998] PRIMARY KEY CLUSTERED ([QuestionDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[quickpastecat] (
    [QuickPasteCatNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [ItemOrder] SMALLINT,
    [DefaultForTypes] TEXT,
    CONSTRAINT [PK__quickpas__83F3EFE346F1890B] PRIMARY KEY CLUSTERED ([QuickPasteCatNum])
);

-- CreateTable
CREATE TABLE [dbo].[quickpastenote] (
    [QuickPasteNoteNum] BIGINT NOT NULL,
    [QuickPasteCatNum] BIGINT,
    [ItemOrder] SMALLINT,
    [Note] TEXT,
    [Abbreviation] VARCHAR(255),
    CONSTRAINT [PK__quickpas__87023C1B159E249B] PRIMARY KEY CLUSTERED ([QuickPasteNoteNum])
);

-- CreateTable
CREATE TABLE [dbo].[reactivation] (
    [ReactivationNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ReactivationStatus] BIGINT,
    [ReactivationNote] TEXT,
    [DoNotContact] INT,
    CONSTRAINT [PK__reactiva__BC206B476CF4ACA6] PRIMARY KEY CLUSTERED ([ReactivationNum])
);

-- CreateTable
CREATE TABLE [dbo].[recall] (
    [RecallNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateDueCalc] DATE,
    [DateDue] DATE,
    [DatePrevious] DATE,
    [RecallInterval] INT,
    [RecallStatus] BIGINT,
    [Note] TEXT,
    [IsDisabled] INT,
    [DateTStamp] DATETIME2,
    [RecallTypeNum] BIGINT,
    [DisableUntilBalance] FLOAT(53),
    [DisableUntilDate] DATE,
    [DateScheduled] DATE,
    [Priority] INT,
    [TimePatternOverride] VARCHAR(255),
    CONSTRAINT [PK__recall__CF27413F0C535707] PRIMARY KEY CLUSTERED ([RecallNum])
);

-- CreateTable
CREATE TABLE [dbo].[recalltrigger] (
    [RecallTriggerNum] BIGINT NOT NULL,
    [RecallTypeNum] BIGINT,
    [CodeNum] BIGINT,
    CONSTRAINT [PK__recalltr__435DF2F787A30E80] PRIMARY KEY CLUSTERED ([RecallTriggerNum])
);

-- CreateTable
CREATE TABLE [dbo].[recalltype] (
    [RecallTypeNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [DefaultInterval] INT,
    [TimePattern] VARCHAR(255),
    [Procedures] VARCHAR(255),
    [AppendToSpecial] INT,
    CONSTRAINT [PK__recallty__1922CCF46B10E5BE] PRIMARY KEY CLUSTERED ([RecallTypeNum])
);

-- CreateTable
CREATE TABLE [dbo].[reconcile] (
    [ReconcileNum] BIGINT NOT NULL,
    [AccountNum] BIGINT,
    [StartingBal] FLOAT(53),
    [EndingBal] FLOAT(53),
    [DateReconcile] DATE,
    [IsLocked] INT,
    CONSTRAINT [PK__reconcil__6F4EF98AA2474209] PRIMARY KEY CLUSTERED ([ReconcileNum])
);

-- CreateTable
CREATE TABLE [dbo].[recurringcharge] (
    [RecurringChargeNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ClinicNum] BIGINT,
    [DateTimeCharge] DATETIME2,
    [ChargeStatus] INT,
    [FamBal] FLOAT(53),
    [PayPlanDue] FLOAT(53),
    [TotalDue] FLOAT(53),
    [RepeatAmt] FLOAT(53),
    [ChargeAmt] FLOAT(53),
    [UserNum] BIGINT,
    [PayNum] BIGINT,
    [CreditCardNum] BIGINT,
    [ErrorMsg] TEXT,
    CONSTRAINT [PK__recurrin__3C6BC2E9F79EF128] PRIMARY KEY CLUSTERED ([RecurringChargeNum])
);

-- CreateTable
CREATE TABLE [dbo].[refattach] (
    [RefAttachNum] BIGINT NOT NULL,
    [ReferralNum] BIGINT,
    [PatNum] BIGINT,
    [ItemOrder] SMALLINT,
    [RefDate] DATE,
    [RefType] INT,
    [RefToStatus] INT,
    [Note] TEXT,
    [IsTransitionOfCare] INT,
    [ProcNum] BIGINT,
    [DateProcComplete] DATE,
    [ProvNum] BIGINT,
    [DateTStamp] DATETIME2,
    CONSTRAINT [PK__refattac__E6C9121AE1B9FF9B] PRIMARY KEY CLUSTERED ([RefAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[referral] (
    [ReferralNum] BIGINT NOT NULL,
    [LName] VARCHAR(100),
    [FName] VARCHAR(100),
    [MName] VARCHAR(100),
    [SSN] VARCHAR(9),
    [UsingTIN] INT,
    [Specialty] BIGINT,
    [ST] VARCHAR(2),
    [Telephone] VARCHAR(30),
    [Address] VARCHAR(100),
    [Address2] VARCHAR(100),
    [City] VARCHAR(100),
    [Zip] VARCHAR(10),
    [Note] TEXT,
    [Phone2] VARCHAR(30),
    [IsHidden] INT,
    [NotPerson] INT,
    [Title] VARCHAR(255),
    [EMail] VARCHAR(255),
    [PatNum] BIGINT,
    [NationalProvID] VARCHAR(255),
    [Slip] BIGINT,
    [IsDoctor] INT,
    [IsTrustedDirect] INT,
    [DateTStamp] DATETIME2,
    [IsPreferred] INT,
    [BusinessName] VARCHAR(255),
    [DisplayNote] VARCHAR(4000),
    CONSTRAINT [PK__referral__06F08130BC359F94] PRIMARY KEY CLUSTERED ([ReferralNum])
);

-- CreateTable
CREATE TABLE [dbo].[referralcliniclink] (
    [ReferralClinicLinkNum] BIGINT NOT NULL,
    [ReferralNum] BIGINT,
    [ClinicNum] BIGINT,
    CONSTRAINT [PK__referral__64E3B14149418864] PRIMARY KEY CLUSTERED ([ReferralClinicLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[registrationkey] (
    [RegistrationKeyNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [RegKey] VARCHAR(4000),
    [Note] VARCHAR(4000),
    [DateStarted] DATE,
    [DateDisabled] DATE,
    [DateEnded] DATE,
    [IsForeign] INT,
    [UsesServerVersion] INT,
    [IsFreeVersion] INT,
    [IsOnlyForTesting] INT,
    [VotesAllotted] INT,
    [IsResellerCustomer] INT,
    [HasEarlyAccess] INT,
    [DateTBackupScheduled] DATETIME2,
    [BackupPassCode] VARCHAR(32),
    [DateTClinicAccess] DATETIME2,
    CONSTRAINT [PK__registra__E5506FC56CB30E6D] PRIMARY KEY CLUSTERED ([RegistrationKeyNum])
);

-- CreateTable
CREATE TABLE [dbo].[reminderrule] (
    [ReminderRuleNum] BIGINT NOT NULL,
    [ReminderCriterion] INT,
    [CriterionFK] BIGINT,
    [CriterionValue] VARCHAR(255),
    [Message] VARCHAR(255),
    CONSTRAINT [PK__reminder__A0AE0D23D1F6B4B5] PRIMARY KEY CLUSTERED ([ReminderRuleNum])
);

-- CreateTable
CREATE TABLE [dbo].[repeatcharge] (
    [RepeatChargeNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ProcCode] VARCHAR(15),
    [ChargeAmt] FLOAT(53),
    [DateStart] DATE,
    [DateStop] DATE,
    [Note] TEXT,
    [CopyNoteToProc] INT,
    [CreatesClaim] INT,
    [IsEnabled] INT,
    [UsePrepay] INT,
    [Npi] TEXT,
    [ErxAccountId] TEXT,
    [ProviderName] TEXT,
    [ChargeAmtAlt] FLOAT(53),
    [UnearnedTypes] VARCHAR(4000),
    [Frequency] INT,
    CONSTRAINT [PK__repeatch__E99E8F955CFF109A] PRIMARY KEY CLUSTERED ([RepeatChargeNum])
);

-- CreateTable
CREATE TABLE [dbo].[replicationserver] (
    [ReplicationServerNum] BIGINT NOT NULL,
    [Descript] TEXT,
    [ServerId] INT,
    [RangeStart] BIGINT,
    [RangeEnd] BIGINT,
    [AtoZpath] VARCHAR(255),
    [UpdateBlocked] INT,
    [SlaveMonitor] VARCHAR(255),
    CONSTRAINT [PK__replicat__5CED00DF65653AE2] PRIMARY KEY CLUSTERED ([ReplicationServerNum])
);

-- CreateTable
CREATE TABLE [dbo].[reqneeded] (
    [ReqNeededNum] BIGINT NOT NULL,
    [Descript] VARCHAR(255),
    [SchoolCourseNum] BIGINT,
    [SchoolClassNum] BIGINT,
    [SchoolCourseDefNum] BIGINT,
    CONSTRAINT [PK__reqneede__ED606FE0704E165E] PRIMARY KEY CLUSTERED ([ReqNeededNum])
);

-- CreateTable
CREATE TABLE [dbo].[reqstudent] (
    [ReqStudentNum] BIGINT NOT NULL,
    [ReqNeededNum] BIGINT,
    [Descript] VARCHAR(255),
    [SchoolCourseNum] BIGINT,
    [ProvNum] BIGINT,
    [AptNum] BIGINT,
    [PatNum] BIGINT,
    [InstructorNum] BIGINT,
    [DateCompleted] DATE,
    [ProcNum] BIGINT,
    CONSTRAINT [PK__reqstude__C743408238533134] PRIMARY KEY CLUSTERED ([ReqStudentNum])
);

-- CreateTable
CREATE TABLE [dbo].[requiredfield] (
    [RequiredFieldNum] BIGINT NOT NULL,
    [FieldType] INT,
    [FieldName] VARCHAR(50),
    CONSTRAINT [PK__required__ED32D4EBF1414141] PRIMARY KEY CLUSTERED ([RequiredFieldNum])
);

-- CreateTable
CREATE TABLE [dbo].[requiredfieldcondition] (
    [RequiredFieldConditionNum] BIGINT NOT NULL,
    [RequiredFieldNum] BIGINT,
    [ConditionType] VARCHAR(50),
    [Operator] INT,
    [ConditionValue] VARCHAR(255),
    [ConditionRelationship] INT,
    CONSTRAINT [PK__required__FF18075ADB412B7B] PRIMARY KEY CLUSTERED ([RequiredFieldConditionNum])
);

-- CreateTable
CREATE TABLE [dbo].[rxalert] (
    [RxAlertNum] BIGINT NOT NULL,
    [RxDefNum] BIGINT,
    [DiseaseDefNum] BIGINT,
    [AllergyDefNum] BIGINT,
    [MedicationNum] BIGINT,
    [NotificationMsg] VARCHAR(255),
    [IsHighSignificance] INT,
    CONSTRAINT [PK__rxalert__39A015D8D95E1D3B] PRIMARY KEY CLUSTERED ([RxAlertNum])
);

-- CreateTable
CREATE TABLE [dbo].[rxdef] (
    [RxDefNum] BIGINT NOT NULL,
    [Drug] VARCHAR(255),
    [Sig] VARCHAR(255),
    [Disp] VARCHAR(255),
    [Refills] VARCHAR(30),
    [Notes] VARCHAR(255),
    [IsControlled] INT,
    [RxCui] BIGINT,
    [IsProcRequired] INT,
    [PatientInstruction] TEXT,
    CONSTRAINT [PK__rxdef__023C494E61B35B8E] PRIMARY KEY CLUSTERED ([RxDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[rxnorm] (
    [RxNormNum] BIGINT NOT NULL,
    [RxCui] VARCHAR(255),
    [MmslCode] VARCHAR(255),
    [Description] TEXT,
    CONSTRAINT [PK__rxnorm__AC970B0C31AF1DA3] PRIMARY KEY CLUSTERED ([RxNormNum])
);

-- CreateTable
CREATE TABLE [dbo].[rxpat] (
    [RxNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [RxDate] DATE,
    [Drug] VARCHAR(255),
    [Sig] VARCHAR(255),
    [Disp] VARCHAR(255),
    [Refills] VARCHAR(30),
    [ProvNum] BIGINT,
    [Notes] VARCHAR(255),
    [PharmacyNum] BIGINT,
    [IsControlled] INT,
    [DateTStamp] DATETIME2,
    [SendStatus] INT,
    [RxCui] BIGINT,
    [DosageCode] VARCHAR(255),
    [ErxGuid] VARCHAR(40),
    [IsErxOld] INT,
    [ErxPharmacyInfo] VARCHAR(255),
    [IsProcRequired] INT,
    [ProcNum] BIGINT,
    [DaysOfSupply] FLOAT(53),
    [PatientInstruction] TEXT,
    [ClinicNum] BIGINT,
    [UserNum] BIGINT,
    [RxType] INT,
    CONSTRAINT [PK__rxpat__4E399A7C1CBA7B8D] PRIMARY KEY CLUSTERED ([RxNum])
);

-- CreateTable
CREATE TABLE [dbo].[schedule] (
    [ScheduleNum] BIGINT NOT NULL,
    [SchedDate] DATE,
    [StartTime] TIME,
    [StopTime] TIME,
    [SchedType] INT,
    [ProvNum] BIGINT,
    [BlockoutType] BIGINT,
    [Note] TEXT,
    [Status] INT,
    [EmployeeNum] BIGINT,
    [DateTStamp] DATETIME2,
    [ClinicNum] BIGINT,
    CONSTRAINT [PK__schedule__92EEA3E36E1120AC] PRIMARY KEY CLUSTERED ([ScheduleNum])
);

-- CreateTable
CREATE TABLE [dbo].[scheduledprocess] (
    [ScheduledProcessNum] BIGINT,
    [ScheduledAction] VARCHAR(50),
    [TimeToRun] DATETIME2,
    [FrequencyToRun] VARCHAR(50),
    [LastRanDateTime] DATETIME2
);

-- CreateTable
CREATE TABLE [dbo].[scheduleop] (
    [ScheduleOpNum] BIGINT NOT NULL,
    [ScheduleNum] BIGINT,
    [OperatoryNum] BIGINT,
    CONSTRAINT [PK__schedule__AA099D63892FCFC3] PRIMARY KEY CLUSTERED ([ScheduleOpNum])
);

-- CreateTable
CREATE TABLE [dbo].[schoolapproval] (
    [SchoolApprovalNum] BIGINT NOT NULL,
    [ProvNum] BIGINT,
    [SignOffStatus] INT,
    [InstructorNum] BIGINT,
    [AptNum] BIGINT,
    [ProcNum] BIGINT,
    [TreatPlanNum] BIGINT,
    [PerioExamNum] BIGINT,
    [AllergyNum] BIGINT,
    [DiseaseNum] BIGINT,
    [DocNum] BIGINT,
    [MountNum] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__schoolap__DBE1534A9458C753] PRIMARY KEY CLUSTERED ([SchoolApprovalNum])
);

-- CreateTable
CREATE TABLE [dbo].[schoolclass] (
    [SchoolClassNum] BIGINT NOT NULL,
    [GradYear] INT,
    [Descript] VARCHAR(255),
    CONSTRAINT [PK__schoolcl__A4C99CB589E81BDD] PRIMARY KEY CLUSTERED ([SchoolClassNum])
);

-- CreateTable
CREATE TABLE [dbo].[schoolcourse] (
    [SchoolCourseNum] BIGINT NOT NULL,
    [CourseID] VARCHAR(255),
    [Descript] VARCHAR(255),
    [DateStart] DATE,
    [DateEnd] DATE,
    [SchoolClassNum] BIGINT,
    [GradingScaleNum] BIGINT,
    CONSTRAINT [PK__schoolco__C577FB3792BD5CD1] PRIMARY KEY CLUSTERED ([SchoolCourseNum])
);

-- CreateTable
CREATE TABLE [dbo].[schoolcoursedef] (
    [SchoolCourseDefNum] BIGINT NOT NULL,
    [CourseID] VARCHAR(255),
    [Descript] VARCHAR(255),
    [GradingScaleNum] BIGINT,
    CONSTRAINT [PK__schoolco__7625DCB759EA1CA7] PRIMARY KEY CLUSTERED ([SchoolCourseDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[schoolcourseenrollee] (
    [SchoolCourseEnrolleeNum] BIGINT NOT NULL,
    [SchoolCourseNum] BIGINT,
    [StudentNum] BIGINT,
    [GradeNumber] FLOAT(53),
    [GradeOverride] FLOAT(53),
    CONSTRAINT [PK__schoolco__29C1EB683BDD8BA6] PRIMARY KEY CLUSTERED ([SchoolCourseEnrolleeNum])
);

-- CreateTable
CREATE TABLE [dbo].[schoolcourseinstructor] (
    [SchoolCourseInstructorNum] BIGINT NOT NULL,
    [SchoolCourseNum] BIGINT,
    [InstructorNum] BIGINT,
    CONSTRAINT [PK__schoolco__AD3B8951F820C937] PRIMARY KEY CLUSTERED ([SchoolCourseInstructorNum])
);

-- CreateTable
CREATE TABLE [dbo].[schoolcoursesched] (
    [SchoolCourseSchedNum] BIGINT NOT NULL,
    [SchoolCourseDefNum] BIGINT,
    [SchoolCourseNum] BIGINT,
    [TimeStart] TIME,
    [TimeEnd] TIME,
    [DayOfTheWeek] INT,
    [DateOverride] DATE,
    [IsOverride] INT,
    [IsCanceled] INT,
    CONSTRAINT [PK__schoolco__190B39F447EF76F2] PRIMARY KEY CLUSTERED ([SchoolCourseSchedNum])
);

-- CreateTable
CREATE TABLE [dbo].[screen] (
    [ScreenNum] BIGINT NOT NULL,
    [Gender] INT,
    [RaceOld] INT,
    [GradeLevel] INT,
    [Age] INT,
    [Urgency] INT,
    [HasCaries] INT,
    [NeedsSealants] INT,
    [CariesExperience] INT,
    [EarlyChildCaries] INT,
    [ExistingSealants] INT,
    [MissingAllTeeth] INT,
    [Birthdate] DATE,
    [ScreenGroupNum] BIGINT,
    [ScreenGroupOrder] SMALLINT,
    [Comments] VARCHAR(255),
    [ScreenPatNum] BIGINT,
    [SheetNum] BIGINT,
    CONSTRAINT [PK__screen__0193EA296C19EF6F] PRIMARY KEY CLUSTERED ([ScreenNum])
);

-- CreateTable
CREATE TABLE [dbo].[screengroup] (
    [ScreenGroupNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [SGDate] DATE,
    [ProvName] VARCHAR(255),
    [ProvNum] BIGINT,
    [PlaceService] INT,
    [County] VARCHAR(255),
    [GradeSchool] VARCHAR(255),
    [SheetDefNum] BIGINT,
    CONSTRAINT [PK__screengr__B152498D28CB49E9] PRIMARY KEY CLUSTERED ([ScreenGroupNum])
);

-- CreateTable
CREATE TABLE [dbo].[screenpat] (
    [ScreenPatNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ScreenGroupNum] BIGINT,
    [SheetNum] BIGINT,
    [PatScreenPerm] INT,
    CONSTRAINT [PK__screenpa__D8B97EFFE966B0DC] PRIMARY KEY CLUSTERED ([ScreenPatNum])
);

-- CreateTable
CREATE TABLE [dbo].[securitylog] (
    [SecurityLogNum] BIGINT NOT NULL,
    [PermType] SMALLINT,
    [UserNum] BIGINT,
    [LogDateTime] DATETIME2,
    [LogText] TEXT,
    [PatNum] BIGINT,
    [CompName] VARCHAR(255),
    [FKey] BIGINT,
    [LogSource] INT,
    [DefNum] BIGINT,
    [DefNumError] BIGINT,
    [DateTPrevious] DATETIME2,
    CONSTRAINT [PK__security__ED50713100678F2A] PRIMARY KEY CLUSTERED ([SecurityLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[securityloghash] (
    [SecurityLogHashNum] BIGINT NOT NULL,
    [SecurityLogNum] BIGINT,
    [LogHash] VARCHAR(255),
    CONSTRAINT [PK__security__5941380B16FD297C] PRIMARY KEY CLUSTERED ([SecurityLogHashNum])
);

-- CreateTable
CREATE TABLE [dbo].[sequencecounter] (
    [CounterNum] BIGINT NOT NULL,
    [CounterName] VARCHAR(255),
    [CounterVal] BIGINT,
    CONSTRAINT [PK__sequence__ED2848802A98C884] PRIMARY KEY CLUSTERED ([CounterNum])
);

-- CreateTable
CREATE TABLE [dbo].[sessiontoken] (
    [SessionTokenNum] BIGINT NOT NULL,
    [SessionTokenHash] VARCHAR(255),
    [Expiration] DATETIME2,
    [TokenType] INT,
    [FKey] BIGINT,
    CONSTRAINT [PK__sessiont__C096FE325AFE0C93] PRIMARY KEY CLUSTERED ([SessionTokenNum])
);

-- CreateTable
CREATE TABLE [dbo].[sheet] (
    [SheetNum] BIGINT NOT NULL,
    [SheetType] INT,
    [PatNum] BIGINT,
    [DateTimeSheet] DATETIME2,
    [FontSize] FLOAT(53),
    [FontName] VARCHAR(255),
    [Width] INT,
    [Height] INT,
    [IsLandscape] INT,
    [InternalNote] TEXT,
    [Description] VARCHAR(255),
    [ShowInTerminal] INT,
    [IsWebForm] INT,
    [IsMultiPage] INT,
    [IsDeleted] INT,
    [SheetDefNum] BIGINT,
    [DocNum] BIGINT,
    [ClinicNum] BIGINT,
    [DateTSheetEdited] DATETIME2,
    [HasMobileLayout] INT,
    [RevID] INT,
    [WebFormSheetID] BIGINT,
    CONSTRAINT [PK__sheet__8588DA59A4FD416F] PRIMARY KEY CLUSTERED ([SheetNum])
);

-- CreateTable
CREATE TABLE [dbo].[sheetdef] (
    [SheetDefNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [SheetType] INT,
    [FontSize] FLOAT(53),
    [FontName] VARCHAR(255),
    [Width] INT,
    [Height] INT,
    [IsLandscape] INT,
    [PageCount] INT,
    [IsMultiPage] INT,
    [BypassGlobalLock] INT,
    [HasMobileLayout] INT,
    [DateTCreated] DATETIME2,
    [RevID] INT,
    [AutoCheckSaveImage] INT,
    [AutoCheckSaveImageDocCategory] BIGINT,
    CONSTRAINT [PK__sheetdef__E60510800C161DAE] PRIMARY KEY CLUSTERED ([SheetDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[sheetfield] (
    [SheetFieldNum] BIGINT NOT NULL,
    [SheetNum] BIGINT,
    [FieldType] INT,
    [FieldName] VARCHAR(255),
    [FieldValue] TEXT,
    [FontSize] FLOAT(53),
    [FontName] VARCHAR(255),
    [FontIsBold] INT,
    [XPos] INT,
    [YPos] INT,
    [Width] INT,
    [Height] INT,
    [GrowthBehavior] INT,
    [RadioButtonValue] VARCHAR(255),
    [RadioButtonGroup] VARCHAR(255),
    [IsRequired] INT,
    [TabOrder] INT,
    [ReportableName] VARCHAR(255),
    [TextAlign] INT,
    [ItemColor] INT,
    [DateTimeSig] DATETIME2,
    [IsLocked] INT,
    [TabOrderMobile] INT,
    [UiLabelMobile] TEXT,
    [UiLabelMobileRadioButton] TEXT,
    [SheetFieldDefNum] BIGINT,
    [CanElectronicallySign] INT,
    [IsSigProvRestricted] INT,
    [UserSigned] BIGINT,
    CONSTRAINT [PK__sheetfie__B853F6841D65DFA3] PRIMARY KEY CLUSTERED ([SheetFieldNum])
);

-- CreateTable
CREATE TABLE [dbo].[sheetfielddef] (
    [SheetFieldDefNum] BIGINT NOT NULL,
    [SheetDefNum] BIGINT,
    [FieldType] INT,
    [FieldName] VARCHAR(255),
    [FieldValue] TEXT,
    [FontSize] FLOAT(53),
    [FontName] VARCHAR(255),
    [FontIsBold] INT,
    [XPos] INT,
    [YPos] INT,
    [Width] INT,
    [Height] INT,
    [GrowthBehavior] INT,
    [RadioButtonValue] VARCHAR(255),
    [RadioButtonGroup] VARCHAR(255),
    [IsRequired] INT,
    [TabOrder] INT,
    [ReportableName] VARCHAR(255),
    [TextAlign] INT,
    [IsPaymentOption] INT,
    [ItemColor] INT,
    [IsLocked] INT,
    [TabOrderMobile] INT,
    [UiLabelMobile] TEXT,
    [UiLabelMobileRadioButton] TEXT,
    [LayoutMode] INT,
    [Language] VARCHAR(255),
    [CanElectronicallySign] INT,
    [IsSigProvRestricted] INT,
    CONSTRAINT [PK__sheetfie__802B9DD92F857297] PRIMARY KEY CLUSTERED ([SheetFieldDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[sigbutdef] (
    [SigButDefNum] BIGINT NOT NULL,
    [ButtonText] VARCHAR(255),
    [ButtonIndex] SMALLINT,
    [SynchIcon] INT,
    [ComputerName] VARCHAR(255),
    [SigElementDefNumUser] BIGINT,
    [SigElementDefNumExtra] BIGINT,
    [SigElementDefNumMsg] BIGINT,
    CONSTRAINT [PK__sigbutde__AE83E1240D8AE854] PRIMARY KEY CLUSTERED ([SigButDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[sigelementdef] (
    [SigElementDefNum] BIGINT NOT NULL,
    [LightRow] INT,
    [LightColor] INT,
    [SigElementType] INT,
    [SigText] VARCHAR(255),
    [Sound] TEXT,
    [ItemOrder] SMALLINT,
    CONSTRAINT [PK__sigeleme__A39D1DA12A600703] PRIMARY KEY CLUSTERED ([SigElementDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[sigmessage] (
    [SigMessageNum] BIGINT NOT NULL,
    [ButtonText] VARCHAR(255),
    [ButtonIndex] INT,
    [SynchIcon] INT,
    [FromUser] VARCHAR(255),
    [ToUser] VARCHAR(255),
    [MessageDateTime] DATETIME2,
    [AckDateTime] DATETIME2,
    [SigText] VARCHAR(255),
    [SigElementDefNumUser] BIGINT,
    [SigElementDefNumExtra] BIGINT,
    [SigElementDefNumMsg] BIGINT,
    CONSTRAINT [PK__sigmessa__8D29C2874EC8B840] PRIMARY KEY CLUSTERED ([SigMessageNum])
);

-- CreateTable
CREATE TABLE [dbo].[signalod] (
    [SignalNum] BIGINT NOT NULL,
    [DateViewing] DATE,
    [SigDateTime] DATETIME2,
    [FKey] BIGINT,
    [FKeyType] VARCHAR(255),
    [IType] INT,
    [RemoteRole] INT,
    [MsgValue] TEXT,
    CONSTRAINT [PK__signalod__55C4155B79979A76] PRIMARY KEY CLUSTERED ([SignalNum])
);

-- CreateTable
CREATE TABLE [dbo].[site] (
    [SiteNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [Note] TEXT,
    [Address] VARCHAR(100),
    [Address2] VARCHAR(100),
    [City] VARCHAR(100),
    [State] VARCHAR(100),
    [Zip] VARCHAR(100),
    [ProvNum] BIGINT,
    [PlaceService] INT,
    CONSTRAINT [PK__site__4E4889B08F4A924A] PRIMARY KEY CLUSTERED ([SiteNum]),
    CONSTRAINT [UQ__site__4EBBBAC92195C98D] UNIQUE NONCLUSTERED ([Description])
);

-- CreateTable
CREATE TABLE [dbo].[smsblockphone] (
    [SmsBlockPhoneNum] BIGINT NOT NULL,
    [BlockWirelessNumber] VARCHAR(255),
    CONSTRAINT [PK__smsblock__EC3ABAC691247F8C] PRIMARY KEY CLUSTERED ([SmsBlockPhoneNum])
);

-- CreateTable
CREATE TABLE [dbo].[smsfrommobile] (
    [SmsFromMobileNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ClinicNum] BIGINT,
    [CommlogNum] BIGINT,
    [MsgText] TEXT,
    [DateTimeReceived] DATETIME2,
    [SmsPhoneNumber] VARCHAR(255),
    [MobilePhoneNumber] VARCHAR(255),
    [MsgPart] INT,
    [MsgTotal] INT,
    [MsgRefID] VARCHAR(255),
    [SmsStatus] INT,
    [Flags] VARCHAR(255),
    [IsHidden] INT,
    [MatchCount] INT,
    [GuidMessage] VARCHAR(255),
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__smsfromm__46C99585CD705069] PRIMARY KEY CLUSTERED ([SmsFromMobileNum]),
    CONSTRAINT [UQ__smsfromm__9E199CA92C20FC38] UNIQUE NONCLUSTERED ([GuidMessage])
);

-- CreateTable
CREATE TABLE [dbo].[smsphone] (
    [SmsPhoneNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [PhoneNumber] VARCHAR(255),
    [DateTimeActive] DATETIME2,
    [DateTimeInactive] DATETIME2,
    [InactiveCode] VARCHAR(255),
    [CountryCode] VARCHAR(255),
    CONSTRAINT [PK__smsphone__4208A25BCBB22291] PRIMARY KEY CLUSTERED ([SmsPhoneNum])
);

-- CreateTable
CREATE TABLE [dbo].[smstomobile] (
    [SmsToMobileNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [GuidMessage] VARCHAR(255),
    [GuidBatch] VARCHAR(255),
    [SmsPhoneNumber] VARCHAR(255),
    [MobilePhoneNumber] VARCHAR(255),
    [IsTimeSensitive] INT,
    [MsgType] INT,
    [MsgText] TEXT,
    [SmsStatus] INT,
    [MsgParts] INT,
    [MsgChargeUSD] FLOAT(53),
    [ClinicNum] BIGINT,
    [CustErrorText] VARCHAR(255),
    [DateTimeSent] DATETIME2,
    [DateTimeTerminated] DATETIME2,
    [IsHidden] INT,
    [MsgDiscountUSD] FLOAT(53),
    [SecDateTEdit] DATETIME2,
    CONSTRAINT [PK__smstomob__D8161D399E2066F0] PRIMARY KEY CLUSTERED ([SmsToMobileNum]),
    CONSTRAINT [UQ__smstomob__9E199CA952FD6ED1] UNIQUE NONCLUSTERED ([GuidMessage])
);

-- CreateTable
CREATE TABLE [dbo].[snomed] (
    [SnomedNum] BIGINT NOT NULL,
    [SnomedCode] VARCHAR(255),
    [Description] VARCHAR(255),
    CONSTRAINT [PK__snomed__5AEEFF1B81B8C5A9] PRIMARY KEY CLUSTERED ([SnomedNum]),
    CONSTRAINT [UQ__snomed__F2A20CC7AFB962A3] UNIQUE NONCLUSTERED ([SnomedCode])
);

-- CreateTable
CREATE TABLE [dbo].[sop] (
    [SopNum] BIGINT NOT NULL,
    [SopCode] VARCHAR(255),
    [Description] VARCHAR(255),
    CONSTRAINT [PK__sop__9E8F2D0BCDE383F4] PRIMARY KEY CLUSTERED ([SopNum]),
    CONSTRAINT [UQ__sop__FFB1BDA05D24BF58] UNIQUE NONCLUSTERED ([SopCode])
);

-- CreateTable
CREATE TABLE [dbo].[stateabbr] (
    [StateAbbrNum] BIGINT NOT NULL,
    [Description] VARCHAR(50),
    [Abbr] VARCHAR(50),
    [MedicaidIDLength] INT,
    CONSTRAINT [PK__stateabb__F5705257611FB66C] PRIMARY KEY CLUSTERED ([StateAbbrNum])
);

-- CreateTable
CREATE TABLE [dbo].[statement] (
    [StatementNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateSent] DATE,
    [DateRangeFrom] DATE,
    [DateRangeTo] DATE,
    [Note] TEXT,
    [NoteBold] TEXT,
    [Mode_] INT,
    [HidePayment] INT,
    [SinglePatient] INT,
    [Intermingled] INT,
    [IsSent] INT,
    [DocNum] BIGINT,
    [DateTStamp] DATETIME2,
    [IsReceipt] INT,
    [IsInvoice] INT,
    [IsInvoiceCopy] INT,
    [EmailSubject] VARCHAR(255),
    [EmailBody] TEXT,
    [SuperFamily] BIGINT,
    [IsBalValid] INT,
    [InsEst] FLOAT(53),
    [BalTotal] FLOAT(53),
    [StatementType] VARCHAR(50),
    [ShortGUID] VARCHAR(30),
    [StatementShortURL] VARCHAR(50),
    [StatementURL] VARCHAR(255),
    [SmsSendStatus] INT,
    [LimitedCustomFamily] INT,
    [ShowTransSinceBalZero] INT,
    CONSTRAINT [PK__statemen__41771743AD5E4752] PRIMARY KEY CLUSTERED ([StatementNum])
);

-- CreateTable
CREATE TABLE [dbo].[statementprod] (
    [StatementProdNum] BIGINT NOT NULL,
    [StatementNum] BIGINT,
    [FKey] BIGINT,
    [ProdType] INT,
    [LateChargeAdjNum] BIGINT,
    [DocNum] BIGINT,
    CONSTRAINT [PK__statemen__624D8275A9567675] PRIMARY KEY CLUSTERED ([StatementProdNum])
);

-- CreateTable
CREATE TABLE [dbo].[stmtlink] (
    [StmtLinkNum] BIGINT NOT NULL,
    [StatementNum] BIGINT,
    [StmtLinkType] INT,
    [FKey] BIGINT,
    CONSTRAINT [PK__stmtlink__A1DBA13F0960B54B] PRIMARY KEY CLUSTERED ([StmtLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[substitutionlink] (
    [SubstitutionLinkNum] BIGINT NOT NULL,
    [PlanNum] BIGINT,
    [CodeNum] BIGINT,
    [SubstitutionCode] VARCHAR(15),
    [SubstOnlyIf] INT,
    CONSTRAINT [PK__substitu__B9DA0EEB57EC9DD2] PRIMARY KEY CLUSTERED ([SubstitutionLinkNum])
);

-- CreateTable
CREATE TABLE [dbo].[supplier] (
    [SupplierNum] BIGINT NOT NULL,
    [Name] VARCHAR(255),
    [Phone] VARCHAR(255),
    [CustomerId] VARCHAR(255),
    [Website] TEXT,
    [UserName] VARCHAR(255),
    [Password] VARCHAR(255),
    [Note] TEXT,
    CONSTRAINT [PK__supplier__8F7FC93E011A1595] PRIMARY KEY CLUSTERED ([SupplierNum])
);

-- CreateTable
CREATE TABLE [dbo].[supply] (
    [SupplyNum] BIGINT NOT NULL,
    [SupplierNum] BIGINT,
    [CatalogNumber] VARCHAR(255),
    [Descript] VARCHAR(255),
    [Category] BIGINT,
    [ItemOrder] INT,
    [LevelDesired] FLOAT(53),
    [IsHidden] INT,
    [Price] FLOAT(53),
    [BarCodeOrID] VARCHAR(255),
    [DispDefaultQuant] FLOAT(53),
    [DispUnitsCount] INT,
    [DispUnitDesc] VARCHAR(255),
    [LevelOnHand] FLOAT(53),
    [OrderQty] INT,
    CONSTRAINT [PK__supply__DA50B81025F9ACF9] PRIMARY KEY CLUSTERED ([SupplyNum])
);

-- CreateTable
CREATE TABLE [dbo].[supplyneeded] (
    [SupplyNeededNum] BIGINT NOT NULL,
    [Description] TEXT,
    [DateAdded] DATE,
    CONSTRAINT [PK__supplyne__0127C2069A5CA188] PRIMARY KEY CLUSTERED ([SupplyNeededNum])
);

-- CreateTable
CREATE TABLE [dbo].[supplyorder] (
    [SupplyOrderNum] BIGINT NOT NULL,
    [SupplierNum] BIGINT,
    [DatePlaced] DATE,
    [Note] TEXT,
    [AmountTotal] FLOAT(53),
    [UserNum] BIGINT,
    [ShippingCharge] FLOAT(53),
    [DateReceived] DATE,
    CONSTRAINT [PK__supplyor__B2A9156BB85DD99F] PRIMARY KEY CLUSTERED ([SupplyOrderNum])
);

-- CreateTable
CREATE TABLE [dbo].[supplyorderitem] (
    [SupplyOrderItemNum] BIGINT NOT NULL,
    [SupplyOrderNum] BIGINT,
    [SupplyNum] BIGINT,
    [Qty] INT,
    [Price] FLOAT(53),
    [DateReceived] DATE,
    CONSTRAINT [PK__supplyor__8A8F2F2119C7E9F4] PRIMARY KEY CLUSTERED ([SupplyOrderItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[task] (
    [TaskNum] BIGINT NOT NULL,
    [TaskListNum] BIGINT,
    [DateTask] DATE,
    [KeyNum] BIGINT,
    [Descript] TEXT,
    [TaskStatus] INT,
    [IsRepeating] INT,
    [DateType] INT,
    [FromNum] BIGINT,
    [ObjectType] INT,
    [DateTimeEntry] DATETIME2,
    [UserNum] BIGINT,
    [DateTimeFinished] DATETIME2,
    [PriorityDefNum] BIGINT,
    [ReminderGroupId] VARCHAR(20),
    [ReminderType] SMALLINT,
    [ReminderFrequency] INT,
    [DateTimeOriginal] DATETIME2,
    [SecDateTEdit] DATETIME2,
    [DescriptOverride] VARCHAR(255),
    [IsReadOnly] INT,
    [Category] BIGINT,
    [TriagePosition] INT,
    CONSTRAINT [PK__task__649960296AA55E1F] PRIMARY KEY CLUSTERED ([TaskNum])
);

-- CreateTable
CREATE TABLE [dbo].[taskancestor] (
    [TaskAncestorNum] BIGINT NOT NULL,
    [TaskNum] BIGINT,
    [TaskListNum] BIGINT,
    CONSTRAINT [PK__taskance__AC596B85E72B47C3] PRIMARY KEY CLUSTERED ([TaskAncestorNum])
);

-- CreateTable
CREATE TABLE [dbo].[taskattachment] (
    [TaskAttachmentNum] BIGINT NOT NULL,
    [TaskNum] BIGINT,
    [DocNum] BIGINT,
    [TextValue] TEXT,
    [Description] VARCHAR(255),
    CONSTRAINT [PK__taskatta__F72F4B827EAFA5B2] PRIMARY KEY CLUSTERED ([TaskAttachmentNum])
);

-- CreateTable
CREATE TABLE [dbo].[taskhist] (
    [TaskHistNum] BIGINT NOT NULL,
    [UserNumHist] BIGINT,
    [DateTStamp] DATETIME2,
    [IsNoteChange] INT,
    [TaskNum] BIGINT,
    [TaskListNum] BIGINT,
    [DateTask] DATE,
    [KeyNum] BIGINT,
    [Descript] TEXT,
    [TaskStatus] INT,
    [IsRepeating] INT,
    [DateType] INT,
    [FromNum] BIGINT,
    [ObjectType] INT,
    [DateTimeEntry] DATETIME2,
    [UserNum] BIGINT,
    [DateTimeFinished] DATETIME2,
    [PriorityDefNum] BIGINT,
    [ReminderGroupId] VARCHAR(20),
    [ReminderType] SMALLINT,
    [ReminderFrequency] INT,
    [DateTimeOriginal] DATETIME2,
    [SecDateTEdit] DATETIME2,
    [DescriptOverride] VARCHAR(255),
    [IsReadOnly] INT,
    [Category] BIGINT,
    [TriagePosition] INT,
    CONSTRAINT [PK__taskhist__BF2ADFCB9A0DBE08] PRIMARY KEY CLUSTERED ([TaskHistNum])
);

-- CreateTable
CREATE TABLE [dbo].[tasklist] (
    [TaskListNum] BIGINT NOT NULL,
    [Descript] VARCHAR(255),
    [Parent] BIGINT,
    [DateTL] DATE,
    [IsRepeating] INT,
    [DateType] INT,
    [FromNum] BIGINT,
    [ObjectType] INT,
    [DateTimeEntry] DATETIME2,
    [GlobalTaskFilterType] INT,
    [TaskListStatus] INT,
    CONSTRAINT [PK__tasklist__B5A5CFA37D6956D2] PRIMARY KEY CLUSTERED ([TaskListNum])
);

-- CreateTable
CREATE TABLE [dbo].[tasknote] (
    [TaskNoteNum] BIGINT NOT NULL,
    [TaskNum] BIGINT,
    [UserNum] BIGINT,
    [DateTimeNote] DATETIME2,
    [Note] TEXT,
    CONSTRAINT [PK__tasknote__F7C996CE328FA4D5] PRIMARY KEY CLUSTERED ([TaskNoteNum])
);

-- CreateTable
CREATE TABLE [dbo].[tasksubscription] (
    [TaskSubscriptionNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [TaskListNum] BIGINT,
    [TaskNum] BIGINT,
    CONSTRAINT [PK__tasksubs__8717B026B2341824] PRIMARY KEY CLUSTERED ([TaskSubscriptionNum])
);

-- CreateTable
CREATE TABLE [dbo].[taskunread] (
    [TaskUnreadNum] BIGINT NOT NULL,
    [TaskNum] BIGINT,
    [UserNum] BIGINT,
    CONSTRAINT [PK__taskunre__E5DBA212F3FF647C] PRIMARY KEY CLUSTERED ([TaskUnreadNum])
);

-- CreateTable
CREATE TABLE [dbo].[terminalactive] (
    [TerminalActiveNum] BIGINT NOT NULL,
    [ComputerName] VARCHAR(255),
    [TerminalStatus] INT,
    [PatNum] BIGINT,
    [SessionId] INT,
    [ProcessId] INT,
    [SessionName] VARCHAR(255),
    CONSTRAINT [PK__terminal__F41616C53611C7C6] PRIMARY KEY CLUSTERED ([TerminalActiveNum])
);

-- CreateTable
CREATE TABLE [dbo].[timeadjust] (
    [TimeAdjustNum] BIGINT NOT NULL,
    [EmployeeNum] BIGINT,
    [TimeEntry] DATETIME2,
    [RegHours] TIME,
    [OTimeHours] TIME,
    [Note] TEXT,
    [IsAuto] INT,
    [ClinicNum] BIGINT,
    [PtoDefNum] BIGINT,
    [PtoHours] TIME,
    [IsUnpaidProtectedLeave] INT,
    [SecuUserNumEntry] BIGINT,
    CONSTRAINT [PK__timeadju__E30EB30AC0A17AF0] PRIMARY KEY CLUSTERED ([TimeAdjustNum])
);

-- CreateTable
CREATE TABLE [dbo].[timecardrule] (
    [TimeCardRuleNum] BIGINT NOT NULL,
    [EmployeeNum] BIGINT,
    [OverHoursPerDay] TIME,
    [AfterTimeOfDay] TIME,
    [BeforeTimeOfDay] TIME,
    [IsOvertimeExempt] INT,
    [MinClockInTime] TIME,
    [HasWeekendRate3] INT,
    CONSTRAINT [PK__timecard__99D1874892114909] PRIMARY KEY CLUSTERED ([TimeCardRuleNum])
);

-- CreateTable
CREATE TABLE [dbo].[toolbutitem] (
    [ToolButItemNum] BIGINT NOT NULL,
    [ProgramNum] BIGINT,
    [ToolBar] SMALLINT,
    [ButtonText] VARCHAR(255),
    CONSTRAINT [PK__toolbuti__A63B12EC5DC10841] PRIMARY KEY CLUSTERED ([ToolButItemNum])
);

-- CreateTable
CREATE TABLE [dbo].[toothgridcell] (
    [ToothGridCellNum] BIGINT NOT NULL,
    [SheetFieldNum] BIGINT,
    [ToothGridColNum] BIGINT,
    [ValueEntered] VARCHAR(255),
    [ToothNum] VARCHAR(10),
    CONSTRAINT [PK__toothgri__EB48F9A03403FFE7] PRIMARY KEY CLUSTERED ([ToothGridCellNum])
);

-- CreateTable
CREATE TABLE [dbo].[toothgridcol] (
    [ToothGridColNum] BIGINT NOT NULL,
    [SheetFieldNum] BIGINT,
    [NameItem] VARCHAR(255),
    [CellType] INT,
    [ItemOrder] SMALLINT,
    [ColumnWidth] SMALLINT,
    [CodeNum] BIGINT,
    [ProcStatus] INT,
    CONSTRAINT [PK__toothgri__0BA10B3BA6A52761] PRIMARY KEY CLUSTERED ([ToothGridColNum])
);

-- CreateTable
CREATE TABLE [dbo].[toothgriddef] (
    [ToothGridDefNum] BIGINT NOT NULL,
    [NameInternal] VARCHAR(255),
    [NameShowing] VARCHAR(255),
    [CellType] INT,
    [ItemOrder] SMALLINT,
    [ColumnWidth] SMALLINT,
    [CodeNum] BIGINT,
    [ProcStatus] INT,
    [SheetFieldDefNum] BIGINT,
    CONSTRAINT [PK__toothgri__44704ED7CB7751D3] PRIMARY KEY CLUSTERED ([ToothGridDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[toothinitial] (
    [ToothInitialNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ToothNum] VARCHAR(2),
    [InitialType] INT,
    [Movement] FLOAT(53),
    [DrawingSegment] TEXT,
    [ColorDraw] INT,
    [SecDateTEntry] DATETIME2,
    [SecDateTEdit] DATETIME2,
    [DrawText] VARCHAR(255),
    CONSTRAINT [PK__toothini__D1DCF70946BAF652] PRIMARY KEY CLUSTERED ([ToothInitialNum])
);

-- CreateTable
CREATE TABLE [dbo].[transaction] (
    [TransactionNum] BIGINT NOT NULL,
    [DateTimeEntry] DATETIME2,
    [UserNum] BIGINT,
    [DepositNum] BIGINT,
    [PayNum] BIGINT,
    [SecUserNumEdit] BIGINT,
    [SecDateTEdit] DATETIME2,
    [TransactionInvoiceNum] BIGINT,
    [NeedsReview] INT,
    CONSTRAINT [PK__transact__829367DA91CCA617] PRIMARY KEY CLUSTERED ([TransactionNum])
);

-- CreateTable
CREATE TABLE [dbo].[transactioninvoice] (
    [TransactionInvoiceNum] BIGINT NOT NULL,
    [FileName] VARCHAR(255),
    [InvoiceData] TEXT,
    [FilePath] VARCHAR(255),
    CONSTRAINT [PK__transact__48A0C711403E8FF8] PRIMARY KEY CLUSTERED ([TransactionInvoiceNum])
);

-- CreateTable
CREATE TABLE [dbo].[treatplan] (
    [TreatPlanNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [DateTP] DATE,
    [Heading] VARCHAR(255),
    [Note] TEXT,
    [Signature] TEXT,
    [SigIsTopaz] INT,
    [ResponsParty] BIGINT,
    [DocNum] BIGINT,
    [TPStatus] INT,
    [SecUserNumEntry] BIGINT,
    [SecDateEntry] DATE,
    [SecDateTEdit] DATETIME2,
    [UserNumPresenter] BIGINT,
    [TPType] INT,
    [SignaturePractice] TEXT,
    [DateTSigned] DATETIME2,
    [DateTPracticeSigned] DATETIME2,
    [SignatureText] VARCHAR(255),
    [SignaturePracticeText] VARCHAR(255),
    [MobileAppDeviceNum] BIGINT,
    CONSTRAINT [PK__treatpla__0E9617B2FE4FC70B] PRIMARY KEY CLUSTERED ([TreatPlanNum])
);

-- CreateTable
CREATE TABLE [dbo].[treatplanattach] (
    [TreatPlanAttachNum] BIGINT NOT NULL,
    [TreatPlanNum] BIGINT,
    [ProcNum] BIGINT,
    [Priority] BIGINT,
    CONSTRAINT [PK__treatpla__A9A5A50D4EAF23FD] PRIMARY KEY CLUSTERED ([TreatPlanAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[treatplanparam] (
    [TreatPlanParamNum] BIGINT,
    [PatNum] BIGINT,
    [TreatPlanNum] BIGINT,
    [ShowDiscount] INT,
    [ShowMaxDed] INT,
    [ShowSubTotals] INT,
    [ShowTotals] INT,
    [ShowCompleted] INT,
    [ShowFees] INT,
    [ShowIns] INT
);

-- CreateTable
CREATE TABLE [dbo].[tsitranslog] (
    [TsiTransLogNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [UserNum] BIGINT,
    [TransType] INT,
    [TransDateTime] DATETIME2,
    [ServiceType] INT,
    [ServiceCode] INT,
    [TransAmt] FLOAT(53),
    [AccountBalance] FLOAT(53),
    [FKeyType] INT,
    [FKey] BIGINT,
    [RawMsgText] VARCHAR(1000),
    [ClientId] VARCHAR(25),
    [TransJson] TEXT,
    [ClinicNum] BIGINT,
    [AggTransLogNum] BIGINT,
    CONSTRAINT [PK__tsitrans__6D4D3D6F8D9C538F] PRIMARY KEY CLUSTERED ([TsiTransLogNum])
);

-- CreateTable
CREATE TABLE [dbo].[ucum] (
    [UcumNum] BIGINT NOT NULL,
    [UcumCode] VARCHAR(255),
    [Description] VARCHAR(255),
    [IsInUse] INT,
    CONSTRAINT [PK__ucum__2AA7CBEED7614911] PRIMARY KEY CLUSTERED ([UcumNum])
);

-- CreateTable
CREATE TABLE [dbo].[updatehistory] (
    [UpdateHistoryNum] BIGINT NOT NULL,
    [DateTimeUpdated] DATETIME2,
    [ProgramVersion] VARCHAR(255),
    [Signature] TEXT,
    CONSTRAINT [PK__updatehi__563EDCD1072450C2] PRIMARY KEY CLUSTERED ([UpdateHistoryNum])
);

-- CreateTable
CREATE TABLE [dbo].[userclinic] (
    [UserClinicNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [ClinicNum] BIGINT,
    CONSTRAINT [PK__userclin__7FDBD85CE2FB3682] PRIMARY KEY CLUSTERED ([UserClinicNum])
);

-- CreateTable
CREATE TABLE [dbo].[usergroup] (
    [UserGroupNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [UserGroupNumCEMT] BIGINT,
    CONSTRAINT [PK__usergrou__46DA4D0CBC2BD271] PRIMARY KEY CLUSTERED ([UserGroupNum])
);

-- CreateTable
CREATE TABLE [dbo].[usergroupattach] (
    [UserGroupAttachNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [UserGroupNum] BIGINT,
    CONSTRAINT [PK__usergrou__A3E0A7F6F058D518] PRIMARY KEY CLUSTERED ([UserGroupAttachNum])
);

-- CreateTable
CREATE TABLE [dbo].[userod] (
    [UserNum] BIGINT NOT NULL,
    [UserName] VARCHAR(255),
    [Password] VARCHAR(255),
    [UserGroupNum] BIGINT,
    [EmployeeNum] BIGINT,
    [ClinicNum] BIGINT,
    [ProvNum] BIGINT,
    [IsHidden] INT,
    [TaskListInBox] BIGINT,
    [AnesthProvType] INT,
    [DefaultHidePopups] INT,
    [PasswordIsStrong] INT,
    [ClinicIsRestricted] INT,
    [InboxHidePopups] INT,
    [UserNumCEMT] BIGINT,
    [DateTFail] DATETIME2,
    [FailedAttempts] INT,
    [DomainUser] VARCHAR(255),
    [IsPasswordResetRequired] INT,
    [MobileWebPin] VARCHAR(255),
    [MobileWebPinFailedAttempts] INT,
    [DateTLastLogin] DATETIME2,
    [EClipboardClinicalPin] VARCHAR(128),
    [BadgeId] VARCHAR(255),
    CONSTRAINT [PK__userod__2C17DA90424484E1] PRIMARY KEY CLUSTERED ([UserNum])
);

-- CreateTable
CREATE TABLE [dbo].[userodapptview] (
    [UserodApptViewNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [ClinicNum] BIGINT,
    [ApptViewNum] BIGINT,
    CONSTRAINT [PK__userodap__86907414C2ED35E9] PRIMARY KEY CLUSTERED ([UserodApptViewNum])
);

-- CreateTable
CREATE TABLE [dbo].[userodpref] (
    [UserOdPrefNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [Fkey] BIGINT,
    [FkeyType] INT,
    [ValueString] TEXT,
    [ClinicNum] BIGINT,
    CONSTRAINT [PK__userodpr__4DDD393A383CCC0F] PRIMARY KEY CLUSTERED ([UserOdPrefNum])
);

-- CreateTable
CREATE TABLE [dbo].[usertoken] (
    [UserTokenNum] BIGINT NOT NULL,
    [UserNum] BIGINT NOT NULL,
    [Token] VARCHAR(255) NOT NULL,
    [TokenType] VARCHAR(50) NOT NULL,
    [ValueString] VARCHAR(max) NOT NULL,
    CONSTRAINT [usertoken_pkey] PRIMARY KEY CLUSTERED ([UserTokenNum]),
    CONSTRAINT [usertoken_Token_key] UNIQUE NONCLUSTERED ([Token])
);

-- CreateTable
CREATE TABLE [dbo].[userquery] (
    [QueryNum] BIGINT NOT NULL,
    [Description] VARCHAR(255),
    [FileName] VARCHAR(255),
    [QueryText] TEXT,
    [IsReleased] INT,
    [IsPromptSetup] INT,
    [DefaultFormatRaw] INT,
    CONSTRAINT [PK__userquer__DB70A02E541C48B2] PRIMARY KEY CLUSTERED ([QueryNum])
);

-- CreateTable
CREATE TABLE [dbo].[userweb] (
    [UserWebNum] BIGINT NOT NULL,
    [FKey] BIGINT,
    [FKeyType] INT,
    [UserName] VARCHAR(255),
    [Password] VARCHAR(255),
    [PasswordResetCode] VARCHAR(255),
    [RequireUserNameChange] INT,
    [DateTimeLastLogin] DATETIME2,
    [RequirePasswordChange] INT,
    CONSTRAINT [PK__userweb__D53846A59A367322] PRIMARY KEY CLUSTERED ([UserWebNum])
);

-- CreateTable
CREATE TABLE [dbo].[utm] (
    [UtmNum] BIGINT NOT NULL,
    [CampaignName] VARCHAR(500),
    [MediumInfo] VARCHAR(500),
    [SourceInfo] VARCHAR(500),
    CONSTRAINT [PK__utm__776E948B828E72A4] PRIMARY KEY CLUSTERED ([UtmNum])
);

-- CreateTable
CREATE TABLE [dbo].[vaccinedef] (
    [VaccineDefNum] BIGINT NOT NULL,
    [CVXCode] VARCHAR(255),
    [VaccineName] VARCHAR(255),
    [DrugManufacturerNum] BIGINT,
    CONSTRAINT [PK__vaccined__3CDD2B4A54D2CEAE] PRIMARY KEY CLUSTERED ([VaccineDefNum])
);

-- CreateTable
CREATE TABLE [dbo].[vaccineobs] (
    [VaccineObsNum] BIGINT NOT NULL,
    [VaccinePatNum] BIGINT,
    [ValType] INT,
    [IdentifyingCode] INT,
    [ValReported] VARCHAR(255),
    [ValCodeSystem] INT,
    [VaccineObsNumGroup] BIGINT,
    [UcumCode] VARCHAR(255),
    [DateObs] DATE,
    [MethodCode] VARCHAR(255),
    CONSTRAINT [PK__vaccineo__E66103BC7F16A8FE] PRIMARY KEY CLUSTERED ([VaccineObsNum])
);

-- CreateTable
CREATE TABLE [dbo].[vaccinepat] (
    [VaccinePatNum] BIGINT NOT NULL,
    [VaccineDefNum] BIGINT,
    [DateTimeStart] DATETIME2,
    [DateTimeEnd] DATETIME2,
    [AdministeredAmt] FLOAT(53),
    [DrugUnitNum] BIGINT,
    [LotNumber] VARCHAR(255),
    [PatNum] BIGINT,
    [Note] TEXT,
    [FilledCity] VARCHAR(255),
    [FilledST] VARCHAR(255),
    [CompletionStatus] INT,
    [AdministrationNoteCode] INT,
    [UserNum] BIGINT,
    [ProvNumOrdering] BIGINT,
    [ProvNumAdminister] BIGINT,
    [DateExpire] DATE,
    [RefusalReason] INT,
    [ActionCode] INT,
    [AdministrationRoute] INT,
    [AdministrationSite] INT,
    CONSTRAINT [PK__vaccinep__ED9E5069F68E6DCF] PRIMARY KEY CLUSTERED ([VaccinePatNum])
);

-- CreateTable
CREATE TABLE [dbo].[vitalsign] (
    [VitalsignNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [Height] FLOAT(53),
    [Weight] FLOAT(53),
    [BpSystolic] SMALLINT,
    [BpDiastolic] SMALLINT,
    [DateTaken] DATE,
    [HasFollowupPlan] INT,
    [IsIneligible] INT,
    [Documentation] TEXT,
    [ChildGotNutrition] INT,
    [ChildGotPhysCouns] INT,
    [WeightCode] VARCHAR(255),
    [HeightExamCode] VARCHAR(30),
    [WeightExamCode] VARCHAR(30),
    [BMIExamCode] VARCHAR(30),
    [EhrNotPerformedNum] BIGINT,
    [PregDiseaseNum] BIGINT,
    [BMIPercentile] INT,
    [Pulse] INT,
    CONSTRAINT [PK__vitalsig__B92C28107212ABFE] PRIMARY KEY CLUSTERED ([VitalsignNum])
);

-- CreateTable
CREATE TABLE [dbo].[webschedcarrierrule] (
    [WebSchedCarrierRuleNum] BIGINT NOT NULL,
    [ClinicNum] BIGINT,
    [CarrierName] VARCHAR(255),
    [DisplayName] VARCHAR(255),
    [Message] TEXT,
    [Rule] INT,
    CONSTRAINT [PK__websched__F9FFAF71D1092223] PRIMARY KEY CLUSTERED ([WebSchedCarrierRuleNum])
);

-- CreateTable
CREATE TABLE [dbo].[webschedrecall] (
    [WebSchedRecallNum] BIGINT,
    [ClinicNum] BIGINT,
    [PatNum] BIGINT,
    [RecallNum] BIGINT,
    [DateTimeEntry] DATETIME2,
    [DateDue] DATETIME2,
    [ReminderCount] INT,
    [DateTimeSent] DATETIME2,
    [DateTimeSendFailed] DATETIME2,
    [SendStatus] INT,
    [ShortGUID] VARCHAR(255),
    [ResponseDescript] TEXT,
    [Source] INT,
    [CommlogNum] BIGINT,
    [MessageType] INT,
    [MessageFk] BIGINT,
    [ApptReminderRuleNum] BIGINT
);

-- CreateTable
CREATE TABLE [dbo].[wikilistheaderwidth] (
    [WikiListHeaderWidthNum] BIGINT NOT NULL,
    [ListName] VARCHAR(255),
    [ColName] VARCHAR(255),
    [ColWidth] INT,
    [PickList] TEXT,
    [IsHidden] INT,
    CONSTRAINT [PK__wikilist__490AB95E50D55770] PRIMARY KEY CLUSTERED ([WikiListHeaderWidthNum])
);

-- CreateTable
CREATE TABLE [dbo].[wikilisthist] (
    [WikiListHistNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [ListName] VARCHAR(255),
    [ListHeaders] TEXT,
    [ListContent] TEXT,
    [DateTimeSaved] DATETIME2,
    CONSTRAINT [PK__wikilist__07D7E976703F9CA9] PRIMARY KEY CLUSTERED ([WikiListHistNum])
);

-- CreateTable
CREATE TABLE [dbo].[wikipage] (
    [WikiPageNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [PageTitle] VARCHAR(255),
    [KeyWords] VARCHAR(255),
    [PageContent] TEXT,
    [DateTimeSaved] DATETIME2,
    [IsDraft] INT,
    [IsLocked] INT,
    [IsDeleted] INT,
    [PageContentPlainText] TEXT,
    CONSTRAINT [PK__wikipage__8097DEB962D4CFBC] PRIMARY KEY CLUSTERED ([WikiPageNum])
);

-- CreateTable
CREATE TABLE [dbo].[wikipagehist] (
    [WikiPageNum] BIGINT NOT NULL,
    [UserNum] BIGINT,
    [PageTitle] VARCHAR(255),
    [PageContent] TEXT,
    [DateTimeSaved] DATETIME2,
    [IsDeleted] INT,
    CONSTRAINT [PK__wikipage__8097DEB93C8762FB] PRIMARY KEY CLUSTERED ([WikiPageNum])
);

-- CreateTable
CREATE TABLE [dbo].[xchargetransaction] (
    [XChargeTransactionNum] BIGINT NOT NULL,
    [TransType] VARCHAR(255),
    [Amount] FLOAT(53),
    [CCEntry] VARCHAR(255),
    [PatNum] BIGINT,
    [Result] VARCHAR(255),
    [ClerkID] VARCHAR(255),
    [ResultCode] VARCHAR(255),
    [Expiration] VARCHAR(255),
    [CCType] VARCHAR(255),
    [CreditCardNum] VARCHAR(255),
    [BatchNum] VARCHAR(255),
    [ItemNum] VARCHAR(255),
    [ApprCode] VARCHAR(255),
    [TransactionDateTime] DATETIME2,
    [BatchTotal] FLOAT(53),
    CONSTRAINT [PK__xcharget__AE2EAF340448D8E1] PRIMARY KEY CLUSTERED ([XChargeTransactionNum])
);

-- CreateTable
CREATE TABLE [dbo].[xwebresponse] (
    [XWebResponseNum] BIGINT NOT NULL,
    [PatNum] BIGINT,
    [ProvNum] BIGINT,
    [ClinicNum] BIGINT,
    [PaymentNum] BIGINT,
    [DateTEntry] DATETIME2,
    [DateTUpdate] DATETIME2,
    [TransactionStatus] INT,
    [ResponseCode] INT,
    [XWebResponseCode] VARCHAR(255),
    [ResponseDescription] VARCHAR(255),
    [OTK] VARCHAR(255),
    [HpfUrl] TEXT,
    [HpfExpiration] DATETIME2,
    [TransactionID] VARCHAR(255),
    [TransactionType] VARCHAR(255),
    [Alias] VARCHAR(255),
    [CardType] VARCHAR(255),
    [CardBrand] VARCHAR(255),
    [CardBrandShort] VARCHAR(255),
    [MaskedAcctNum] VARCHAR(255),
    [Amount] FLOAT(53),
    [ApprovalCode] VARCHAR(255),
    [CardCodeResponse] VARCHAR(255),
    [ReceiptID] INT,
    [ExpDate] VARCHAR(255),
    [EntryMethod] VARCHAR(255),
    [ProcessorResponse] VARCHAR(255),
    [BatchNum] INT,
    [BatchAmount] FLOAT(53),
    [AccountExpirationDate] DATE,
    [DebugError] TEXT,
    [PayNote] TEXT,
    [CCSource] INT,
    [OrderId] VARCHAR(255),
    [EmailResponse] VARCHAR(255),
    [LogGuid] VARCHAR(36),
    CONSTRAINT [PK__xwebresp__52F5370BC3543710] PRIMARY KEY CLUSTERED ([XWebResponseNum])
);

-- CreateTable
CREATE TABLE [dbo].[zipcode] (
    [ZipCodeNum] BIGINT NOT NULL,
    [ZipCodeDigits] VARCHAR(20),
    [City] VARCHAR(100),
    [State] VARCHAR(20),
    [IsFrequent] INT,
    CONSTRAINT [PK__zipcode__8516C3AAEABF6843] PRIMARY KEY CLUSTERED ([ZipCodeNum])
);

-- CreateTable
CREATE TABLE [dbo].[examradiographic] (
    [ExamId] BIGINT NOT NULL IDENTITY(1,1),
    [PatNum] BIGINT NOT NULL,
    [AptNum] BIGINT NOT NULL,
    [ProvNum] BIGINT NOT NULL,
    [IsSigned] BIT NOT NULL CONSTRAINT [examradiographic_IsSigned_df] DEFAULT 0,
    [SignedBy] BIGINT,
    [SignedAt] DATETIME2,
    [CreatedBy] BIGINT,
    [UpdatedBy] BIGINT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [examradiographic_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [ExamData] TEXT,
    CONSTRAINT [examradiographic_pkey] PRIMARY KEY CLUSTERED ([ExamId]),
    CONSTRAINT [examradiographic_AptNum_key] UNIQUE NONCLUSTERED ([AptNum])
);

-- CreateTable
CREATE TABLE [dbo].[examtmj] (
    [ExamId] BIGINT NOT NULL IDENTITY(1,1),
    [PatNum] BIGINT NOT NULL,
    [AptNum] BIGINT NOT NULL,
    [ProvNum] BIGINT NOT NULL,
    [IsSigned] BIT NOT NULL CONSTRAINT [examtmj_IsSigned_df] DEFAULT 0,
    [SignedBy] BIGINT,
    [SignedAt] DATETIME2,
    [CreatedBy] BIGINT,
    [UpdatedBy] BIGINT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [examtmj_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [ExamData] TEXT,
    CONSTRAINT [examtmj_pkey] PRIMARY KEY CLUSTERED ([ExamId]),
    CONSTRAINT [examtmj_AptNum_key] UNIQUE NONCLUSTERED ([AptNum])
);

-- CreateTable
CREATE TABLE [dbo].[examheadneck] (
    [ExamId] BIGINT NOT NULL IDENTITY(1,1),
    [PatNum] BIGINT NOT NULL,
    [AptNum] BIGINT NOT NULL,
    [ProvNum] BIGINT NOT NULL,
    [IsSigned] BIT NOT NULL CONSTRAINT [examheadneck_IsSigned_df] DEFAULT 0,
    [SignedBy] BIGINT,
    [SignedAt] DATETIME2,
    [CreatedBy] BIGINT,
    [UpdatedBy] BIGINT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [examheadneck_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [ExamData] TEXT,
    CONSTRAINT [examheadneck_pkey] PRIMARY KEY CLUSTERED ([ExamId]),
    CONSTRAINT [examheadneck_AptNum_key] UNIQUE NONCLUSTERED ([AptNum])
);

-- CreateTable
CREATE TABLE [dbo].[examtoothstructure] (
    [ExamId] BIGINT NOT NULL IDENTITY(1,1),
    [PatNum] BIGINT NOT NULL,
    [AptNum] BIGINT NOT NULL,
    [ProvNum] BIGINT NOT NULL,
    [IsSigned] BIT NOT NULL CONSTRAINT [examtoothstructure_IsSigned_df] DEFAULT 0,
    [SignedBy] BIGINT,
    [SignedAt] DATETIME2,
    [CreatedBy] BIGINT,
    [UpdatedBy] BIGINT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [examtoothstructure_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [ExamData] TEXT,
    CONSTRAINT [examtoothstructure_pkey] PRIMARY KEY CLUSTERED ([ExamId]),
    CONSTRAINT [examtoothstructure_AptNum_key] UNIQUE NONCLUSTERED ([AptNum])
);

-- CreateTable
CREATE TABLE [dbo].[exammorphological] (
    [ExamId] BIGINT NOT NULL IDENTITY(1,1),
    [PatNum] BIGINT NOT NULL,
    [AptNum] BIGINT NOT NULL,
    [ProvNum] BIGINT NOT NULL,
    [IsSigned] BIT NOT NULL CONSTRAINT [exammorphological_IsSigned_df] DEFAULT 0,
    [SignedBy] BIGINT,
    [SignedAt] DATETIME2,
    [CreatedBy] BIGINT,
    [UpdatedBy] BIGINT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [exammorphological_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [ExamData] TEXT,
    CONSTRAINT [exammorphological_pkey] PRIMARY KEY CLUSTERED ([ExamId]),
    CONSTRAINT [exammorphological_AptNum_key] UNIQUE NONCLUSTERED ([AptNum])
);

-- CreateTable
CREATE TABLE [dbo].[examperiodontal] (
    [ExamId] BIGINT NOT NULL IDENTITY(1,1),
    [PatNum] BIGINT NOT NULL,
    [AptNum] BIGINT NOT NULL,
    [ProvNum] BIGINT NOT NULL,
    [IsSigned] BIT NOT NULL CONSTRAINT [examperiodontal_IsSigned_df] DEFAULT 0,
    [SignedBy] BIGINT,
    [SignedAt] DATETIME2,
    [CreatedBy] BIGINT,
    [UpdatedBy] BIGINT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [examperiodontal_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [ExamData] NVARCHAR(max),
    CONSTRAINT [examperiodontal_pkey] PRIMARY KEY CLUSTERED ([ExamId]),
    CONSTRAINT [examperiodontal_AptNum_key] UNIQUE NONCLUSTERED ([AptNum])
);

-- CreateTable
CREATE TABLE [dbo].[examdentofacial] (
    [ExamId] BIGINT NOT NULL IDENTITY(1,1),
    [PatNum] BIGINT NOT NULL,
    [AptNum] BIGINT NOT NULL,
    [ProvNum] BIGINT NOT NULL,
    [IsSigned] BIT NOT NULL CONSTRAINT [examdentofacial_IsSigned_df] DEFAULT 0,
    [SignedBy] BIGINT,
    [SignedAt] DATETIME2,
    [CreatedBy] BIGINT,
    [UpdatedBy] BIGINT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [examdentofacial_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [ExamData] TEXT,
    CONSTRAINT [examdentofacial_pkey] PRIMARY KEY CLUSTERED ([ExamId]),
    CONSTRAINT [examdentofacial_AptNum_key] UNIQUE NONCLUSTERED ([AptNum])
);

-- CreateTable
CREATE TABLE [dbo].[examairway] (
    [ExamId] BIGINT NOT NULL IDENTITY(1,1),
    [PatNum] BIGINT NOT NULL,
    [AptNum] BIGINT NOT NULL,
    [ProvNum] BIGINT NOT NULL,
    [IsSigned] BIT NOT NULL CONSTRAINT [examairway_IsSigned_df] DEFAULT 0,
    [SignedBy] BIGINT,
    [SignedAt] DATETIME2,
    [CreatedBy] BIGINT,
    [UpdatedBy] BIGINT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [examairway_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    [ExamData] TEXT,
    CONSTRAINT [examairway_pkey] PRIMARY KEY CLUSTERED ([ExamId]),
    CONSTRAINT [examairway_AptNum_key] UNIQUE NONCLUSTERED ([AptNum])
);

-- CreateTable
CREATE TABLE [dbo].[clinicalproductcategory] (
    [CategoryId] BIGINT NOT NULL IDENTITY(1,1),
    [Name] VARCHAR(255) NOT NULL,
    [Section] VARCHAR(50) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [clinicalproductcategory_IsActive_df] DEFAULT 1,
    CONSTRAINT [clinicalproductcategory_pkey] PRIMARY KEY CLUSTERED ([CategoryId])
);

-- CreateTable
CREATE TABLE [dbo].[clinicalproductchoice] (
    [ChoiceId] BIGINT NOT NULL IDENTITY(1,1),
    [CategoryId] BIGINT NOT NULL,
    [Name] VARCHAR(255) NOT NULL,
    [IsDefault] BIT NOT NULL CONSTRAINT [clinicalproductchoice_IsDefault_df] DEFAULT 0,
    [QuickList] BIT NOT NULL CONSTRAINT [clinicalproductchoice_QuickList_df] DEFAULT 0,
    [IsRecommended] BIT NOT NULL CONSTRAINT [clinicalproductchoice_IsRecommended_df] DEFAULT 0,
    [Price] DECIMAL(10,2) NOT NULL,
    [Code] VARCHAR(100) NOT NULL CONSTRAINT [clinicalproductchoice_Code_df] DEFAULT '',
    [IsActive] BIT NOT NULL CONSTRAINT [clinicalproductchoice_IsActive_df] DEFAULT 1,
    CONSTRAINT [clinicalproductchoice_pkey] PRIMARY KEY CLUSTERED ([ChoiceId])
);

-- CreateTable
CREATE TABLE [dbo].[clinicalchecklistcategory] (
    [CategoryId] BIGINT NOT NULL IDENTITY(1,1),
    [Name] VARCHAR(255) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [clinicalchecklistcategory_IsActive_df] DEFAULT 1,
    CONSTRAINT [clinicalchecklistcategory_pkey] PRIMARY KEY CLUSTERED ([CategoryId])
);

-- CreateTable
CREATE TABLE [dbo].[clinicalchecklist] (
    [ChecklistId] BIGINT NOT NULL IDENTITY(1,1),
    [CategoryId] BIGINT NOT NULL,
    [Name] VARCHAR(255) NOT NULL,
    [ShortName] VARCHAR(100) NOT NULL,
    [IsTreatment] BIT NOT NULL CONSTRAINT [clinicalchecklist_IsTreatment_df] DEFAULT 1,
    [IsHygiene] BIT NOT NULL CONSTRAINT [clinicalchecklist_IsHygiene_df] DEFAULT 0,
    [IconId] VARCHAR(50) NOT NULL CONSTRAINT [clinicalchecklist_IconId_df] DEFAULT 'tooth-prep',
    [IsActive] BIT NOT NULL CONSTRAINT [clinicalchecklist_IsActive_df] DEFAULT 1,
    CONSTRAINT [clinicalchecklist_pkey] PRIMARY KEY CLUSTERED ([ChecklistId])
);

-- CreateTable
CREATE TABLE [dbo].[clinicalchecklistitem] (
    [ItemId] BIGINT NOT NULL IDENTITY(1,1),
    [ChecklistId] BIGINT NOT NULL,
    [Text] VARCHAR(1000) NOT NULL,
    [Choices] VARCHAR(max) NOT NULL CONSTRAINT [clinicalchecklistitem_Choices_df] DEFAULT '[]',
    [Products] VARCHAR(max) NOT NULL CONSTRAINT [clinicalchecklistitem_Products_df] DEFAULT '[]',
    [IsActive] BIT NOT NULL CONSTRAINT [clinicalchecklistitem_IsActive_df] DEFAULT 1,
    CONSTRAINT [clinicalchecklistitem_pkey] PRIMARY KEY CLUSTERED ([ItemId])
);

-- CreateTable
CREATE TABLE [dbo].[prescriptiontemplate] (
    [TemplateId] BIGINT NOT NULL IDENTITY(1,1),
    [Name] VARCHAR(255) NOT NULL,
    [Drug] VARCHAR(255) NOT NULL,
    [Sig] VARCHAR(1000) NOT NULL,
    [Disp] VARCHAR(255) NOT NULL,
    [Refills] VARCHAR(50) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [prescriptiontemplate_IsActive_df] DEFAULT 1,
    CONSTRAINT [prescriptiontemplate_pkey] PRIMARY KEY CLUSTERED ([TemplateId])
);

-- CreateTable
CREATE TABLE [dbo].[clinicalsystemsetting] (
    [SettingId] BIGINT NOT NULL IDENTITY(1,1),
    [Key] VARCHAR(255) NOT NULL,
    [Value] VARCHAR(max) NOT NULL,
    CONSTRAINT [clinicalsystemsetting_pkey] PRIMARY KEY CLUSTERED ([SettingId]),
    CONSTRAINT [clinicalsystemsetting_Key_key] UNIQUE NONCLUSTERED ([Key])
);

-- CreateTable
CREATE TABLE [dbo].[clinicalrecareconfig] (
    [ConfigId] BIGINT NOT NULL IDENTITY(1,1),
    [IntervalMonths] INT NOT NULL CONSTRAINT [clinicalrecareconfig_IntervalMonths_df] DEFAULT 6,
    [AutoReminder] BIT NOT NULL CONSTRAINT [clinicalrecareconfig_AutoReminder_df] DEFAULT 1,
    CONSTRAINT [clinicalrecareconfig_pkey] PRIMARY KEY CLUSTERED ([ConfigId])
);

-- CreateTable
CREATE TABLE [dbo].[treatmentplanpresentationconfig] (
    [ConfigId] BIGINT NOT NULL IDENTITY(1,1),
    [ShowHeader] BIT NOT NULL CONSTRAINT [treatmentplanpresentationconfig_ShowHeader_df] DEFAULT 1,
    [ShowFooter] BIT NOT NULL CONSTRAINT [treatmentplanpresentationconfig_ShowFooter_df] DEFAULT 1,
    [ThemeColor] VARCHAR(50) NOT NULL CONSTRAINT [treatmentplanpresentationconfig_ThemeColor_df] DEFAULT '#1a3a6b',
    CONSTRAINT [treatmentplanpresentationconfig_pkey] PRIMARY KEY CLUSTERED ([ConfigId])
);

-- CreateTable
CREATE TABLE [dbo].[informedconsenttemplate] (
    [TemplateId] BIGINT NOT NULL IDENTITY(1,1),
    [Name] VARCHAR(255) NOT NULL,
    [Content] NVARCHAR(max) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [informedconsenttemplate_IsActive_df] DEFAULT 1,
    CONSTRAINT [informedconsenttemplate_pkey] PRIMARY KEY CLUSTERED ([TemplateId])
);

-- CreateTable
CREATE TABLE [dbo].[prepostopinstructiontemplate] (
    [TemplateId] BIGINT NOT NULL IDENTITY(1,1),
    [Name] VARCHAR(255) NOT NULL,
    [Type] VARCHAR(50) NOT NULL,
    [Content] NVARCHAR(max) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [prepostopinstructiontemplate_IsActive_df] DEFAULT 1,
    CONSTRAINT [prepostopinstructiontemplate_pkey] PRIMARY KEY CLUSTERED ([TemplateId])
);

-- CreateTable
CREATE TABLE [dbo].[paymentterminal] (
    [TerminalNum] BIGINT NOT NULL IDENTITY(1,1),
    [Type] VARCHAR(50) NOT NULL,
    [SerialNum] VARCHAR(255) NOT NULL,
    [AccountToken] VARCHAR(255),
    [Name] VARCHAR(255),
    [MerchantId] VARCHAR(255),
    [Model] VARCHAR(255),
    [DeviceId] VARCHAR(255),
    [TerminalId] VARCHAR(255),
    [LaneId] VARCHAR(50),
    [IsActive] BIT NOT NULL CONSTRAINT [paymentterminal_IsActive_df] DEFAULT 1,
    CONSTRAINT [paymentterminal_pkey] PRIMARY KEY CLUSTERED ([TerminalNum])
);

-- CreateTable
CREATE TABLE [dbo].[archivedreport] (
    [ReportId] BIGINT NOT NULL IDENTITY(1,1),
    [ReportType] VARCHAR(50) NOT NULL,
    [SnapshotDate] DATETIME2 NOT NULL CONSTRAINT [archivedreport_SnapshotDate_df] DEFAULT CURRENT_TIMESTAMP,
    [ReportData] VARCHAR(max) NOT NULL,
    [CreatedBy] BIGINT,
    CONSTRAINT [archivedreport_pkey] PRIMARY KEY CLUSTERED ([ReportId])
);

-- AddForeignKey
ALTER TABLE [dbo].[accountingautopay] ADD CONSTRAINT [fk_accountingautopay_1_PayType] FOREIGN KEY ([PayType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[accountingautopay] ADD CONSTRAINT [fk_accountingautopay_2_PickList] FOREIGN KEY ([PickList]) REFERENCES [dbo].[account]([AccountNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[activeinstance] ADD CONSTRAINT [fk_activeinstance_1_ComputerNum] FOREIGN KEY ([ComputerNum]) REFERENCES [dbo].[computer]([ComputerNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[activeinstance] ADD CONSTRAINT [fk_activeinstance_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[adjustment] ADD CONSTRAINT [fk_adjustment_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[adjustment] ADD CONSTRAINT [fk_adjustment_2_AdjType] FOREIGN KEY ([AdjType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[adjustment] ADD CONSTRAINT [fk_adjustment_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[adjustment] ADD CONSTRAINT [fk_adjustment_4_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[adjustment] ADD CONSTRAINT [fk_adjustment_5_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[adjustment] ADD CONSTRAINT [fk_adjustment_6_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [dbo].[statement]([StatementNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[adjustment] ADD CONSTRAINT [fk_adjustment_7_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[alertcategorylink] ADD CONSTRAINT [fk_alertcategorylink_1_AlertCategoryNum] FOREIGN KEY ([AlertCategoryNum]) REFERENCES [dbo].[alertcategory]([AlertCategoryNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[alertitem] ADD CONSTRAINT [fk_alertitem_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[alertitem] ADD CONSTRAINT [fk_alertitem_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[alertread] ADD CONSTRAINT [fk_alertread_1_AlertItemNum] FOREIGN KEY ([AlertItemNum]) REFERENCES [dbo].[alertitem]([AlertItemNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[alertread] ADD CONSTRAINT [fk_alertread_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[alertsub] ADD CONSTRAINT [fk_alertsub_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[alertsub] ADD CONSTRAINT [fk_alertsub_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[alertsub] ADD CONSTRAINT [fk_alertsub_3_AlertCategoryNum] FOREIGN KEY ([AlertCategoryNum]) REFERENCES [dbo].[alertcategory]([AlertCategoryNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[allergy] ADD CONSTRAINT [fk_allergy_1_AllergyDefNum] FOREIGN KEY ([AllergyDefNum]) REFERENCES [dbo].[allergydef]([AllergyDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[allergy] ADD CONSTRAINT [fk_allergy_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[allergydef] ADD CONSTRAINT [fk_allergydef_1_MedicationNum] FOREIGN KEY ([MedicationNum]) REFERENCES [dbo].[medication]([MedicationNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_10_InsPlan1] FOREIGN KEY ([InsPlan1]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_11_InsPlan2] FOREIGN KEY ([InsPlan2]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_12_AppointmentTypeNum] FOREIGN KEY ([AppointmentTypeNum]) REFERENCES [dbo].[appointmenttype]([AppointmentTypeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_13_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_2_Confirmed] FOREIGN KEY ([Confirmed]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_3_Op] FOREIGN KEY ([Op]) REFERENCES [dbo].[operatory]([OperatoryNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_5_ProvHyg] FOREIGN KEY ([ProvHyg]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_6_NextAptNum] FOREIGN KEY ([NextAptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_7_UnschedStatus] FOREIGN KEY ([UnschedStatus]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_8_Assistant] FOREIGN KEY ([Assistant]) REFERENCES [dbo].[employee]([EmployeeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointment] ADD CONSTRAINT [fk_appointment_9_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptfield] ADD CONSTRAINT [fk_apptfield_1_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptfield] ADD CONSTRAINT [fk_apptfield_2_FieldName] FOREIGN KEY ([FieldName]) REFERENCES [dbo].[apptfielddef]([FieldName]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptgeneralmessagesent] ADD CONSTRAINT [fk_apptgeneralmessagesent_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptgeneralmessagesent] ADD CONSTRAINT [fk_apptgeneralmessagesent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptgeneralmessagesent] ADD CONSTRAINT [fk_apptgeneralmessagesent_3_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [dbo].[apptreminderrule]([ApptReminderRuleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptnewpatthankyousent] ADD CONSTRAINT [fk_apptnewpatthankyousent_1_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [dbo].[apptreminderrule]([ApptReminderRuleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptnewpatthankyousent] ADD CONSTRAINT [fk_apptnewpatthankyousent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptnewpatthankyousent] ADD CONSTRAINT [fk_apptnewpatthankyousent_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptreminderrule] ADD CONSTRAINT [fk_apptreminderrule_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptreminderrule] ADD CONSTRAINT [fk_apptreminderrule_2_EmailHostingTemplateNum] FOREIGN KEY ([EmailHostingTemplateNum]) REFERENCES [dbo].[emailhostingtemplate]([EmailHostingTemplateNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptremindersent] ADD CONSTRAINT [fk_apptremindersent_1_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [dbo].[apptreminderrule]([ApptReminderRuleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptremindersent] ADD CONSTRAINT [fk_apptremindersent_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptremindersent] ADD CONSTRAINT [fk_apptremindersent_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptthankyousent] ADD CONSTRAINT [fk_apptthankyousent_1_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [dbo].[apptreminderrule]([ApptReminderRuleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptthankyousent] ADD CONSTRAINT [fk_apptthankyousent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptthankyousent] ADD CONSTRAINT [fk_apptthankyousent_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptview] ADD CONSTRAINT [fk_apptview_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptviewitem] ADD CONSTRAINT [fk_apptviewitem_1_ApptViewNum] FOREIGN KEY ([ApptViewNum]) REFERENCES [dbo].[apptview]([ApptViewNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptviewitem] ADD CONSTRAINT [fk_apptviewitem_2_OpNum] FOREIGN KEY ([OpNum]) REFERENCES [dbo].[operatory]([OperatoryNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptviewitem] ADD CONSTRAINT [fk_apptviewitem_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptviewitem] ADD CONSTRAINT [fk_apptviewitem_4_ApptFieldDefNum] FOREIGN KEY ([ApptFieldDefNum]) REFERENCES [dbo].[apptfielddef]([ApptFieldDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[apptviewitem] ADD CONSTRAINT [fk_apptviewitem_5_PatFieldDefNum] FOREIGN KEY ([PatFieldDefNum]) REFERENCES [dbo].[patfielddef]([PatFieldDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[asapcomm] ADD CONSTRAINT [fk_asapcomm_1_ScheduleNum] FOREIGN KEY ([ScheduleNum]) REFERENCES [dbo].[schedule]([ScheduleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[asapcomm] ADD CONSTRAINT [fk_asapcomm_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[asapcomm] ADD CONSTRAINT [fk_asapcomm_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[asapcomm] ADD CONSTRAINT [fk_asapcomm_4_EmailMessageNum] FOREIGN KEY ([EmailMessageNum]) REFERENCES [dbo].[emailmessage]([EmailMessageNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[asapcomm] ADD CONSTRAINT [fk_asapcomm_5_GuidMessageToMobile] FOREIGN KEY ([GuidMessageToMobile]) REFERENCES [dbo].[smstomobile]([GuidMessage]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[asapcomm] ADD CONSTRAINT [fk_asapcomm_6_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[autocodecond] ADD CONSTRAINT [fk_autocodecond_1_AutoCodeItemNum] FOREIGN KEY ([AutoCodeItemNum]) REFERENCES [dbo].[autocodeitem]([AutoCodeItemNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[autocodeitem] ADD CONSTRAINT [fk_autocodeitem_1_AutoCodeNum] FOREIGN KEY ([AutoCodeNum]) REFERENCES [dbo].[autocode]([AutoCodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[autocodeitem] ADD CONSTRAINT [fk_autocodeitem_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[automation] ADD CONSTRAINT [fk_automation_1_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[automation] ADD CONSTRAINT [fk_automation_2_CommType] FOREIGN KEY ([CommType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[automation] ADD CONSTRAINT [fk_automation_3_AppointmentTypeNum] FOREIGN KEY ([AppointmentTypeNum]) REFERENCES [dbo].[appointmenttype]([AppointmentTypeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[automationcondition] ADD CONSTRAINT [fk_automationcondition_1_AutomationNum] FOREIGN KEY ([AutomationNum]) REFERENCES [dbo].[automation]([AutomationNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[autonote] ADD CONSTRAINT [fk_autonote_1_Category] FOREIGN KEY ([Category]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[benefit] ADD CONSTRAINT [fk_benefit_1_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[benefit] ADD CONSTRAINT [fk_benefit_2_PatPlanNum] FOREIGN KEY ([PatPlanNum]) REFERENCES [dbo].[patplan]([PatPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[benefit] ADD CONSTRAINT [fk_benefit_3_CovCatNum] FOREIGN KEY ([CovCatNum]) REFERENCES [dbo].[covcat]([CovCatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[benefit] ADD CONSTRAINT [fk_benefit_4_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[benefit] ADD CONSTRAINT [fk_benefit_5_CodeGroupNum] FOREIGN KEY ([CodeGroupNum]) REFERENCES [dbo].[codegroup]([CodeGroupNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[branding] ADD CONSTRAINT [fk_branding_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[carecreditwebresponse] ADD CONSTRAINT [fk_carecreditwebresponse_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[carecreditwebresponse] ADD CONSTRAINT [fk_carecreditwebresponse_2_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [dbo].[payment]([PayNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[carecreditwebresponse] ADD CONSTRAINT [fk_carecreditwebresponse_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[carrier] ADD CONSTRAINT [fk_carrier_1_CanadianNetworkNum] FOREIGN KEY ([CanadianNetworkNum]) REFERENCES [dbo].[canadiannetwork]([CanadianNetworkNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[carrier] ADD CONSTRAINT [fk_carrier_2_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[carrier] ADD CONSTRAINT [fk_carrier_3_CarrierGroupName] FOREIGN KEY ([CarrierGroupName]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[cdspermission] ADD CONSTRAINT [fk_cdspermission_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[cert] ADD CONSTRAINT [fk_cert_1_CertCategoryNum] FOREIGN KEY ([CertCategoryNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[certemployee] ADD CONSTRAINT [fk_certemployee_1_CertNum] FOREIGN KEY ([CertNum]) REFERENCES [dbo].[cert]([CertNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[certemployee] ADD CONSTRAINT [fk_certemployee_2_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [dbo].[employee]([EmployeeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[certemployee] ADD CONSTRAINT [fk_certemployee_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chatattach] ADD CONSTRAINT [fk_chatattach_1_ChatMsgNum] FOREIGN KEY ([ChatMsgNum]) REFERENCES [dbo].[chatmsg]([ChatMsgNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chatmsg] ADD CONSTRAINT [fk_chatmsg_1_ChatNum] FOREIGN KEY ([ChatNum]) REFERENCES [dbo].[chat]([ChatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chatmsg] ADD CONSTRAINT [fk_chatmsg_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chatmsg] ADD CONSTRAINT [fk_chatmsg_3_Quote] FOREIGN KEY ([Quote]) REFERENCES [dbo].[chatmsg]([ChatMsgNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chatreaction] ADD CONSTRAINT [fk_chatreaction_1_ChatMsgNum] FOREIGN KEY ([ChatMsgNum]) REFERENCES [dbo].[chatmsg]([ChatMsgNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chatreaction] ADD CONSTRAINT [fk_chatreaction_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chatuserattach] ADD CONSTRAINT [fk_chatuserattach_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chatuserattach] ADD CONSTRAINT [fk_chatuserattach_2_ChatNum] FOREIGN KEY ([ChatNum]) REFERENCES [dbo].[chat]([ChatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chatuserod] ADD CONSTRAINT [fk_chatuserod_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_10_InsSubNum2] FOREIGN KEY ([InsSubNum2]) REFERENCES [dbo].[inssub]([InsSubNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_11_CustomTracking] FOREIGN KEY ([CustomTracking]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_12_ProvOrderOverride] FOREIGN KEY ([ProvOrderOverride]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_13_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_14_OrderingReferralNum] FOREIGN KEY ([OrderingReferralNum]) REFERENCES [dbo].[referral]([ReferralNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_2_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_3_ProvTreat] FOREIGN KEY ([ProvTreat]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_4_ProvBill] FOREIGN KEY ([ProvBill]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_5_ReferringProv] FOREIGN KEY ([ReferringProv]) REFERENCES [dbo].[referral]([ReferralNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_6_PlanNum2] FOREIGN KEY ([PlanNum2]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_8_ClaimForm] FOREIGN KEY ([ClaimForm]) REFERENCES [dbo].[claimform]([ClaimFormNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claim] ADD CONSTRAINT [fk_claim_9_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [dbo].[inssub]([InsSubNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimattach] ADD CONSTRAINT [fk_claimattach_1_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [dbo].[claim]([ClaimNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimcondcodelog] ADD CONSTRAINT [fk_claimcondcodelog_1_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [dbo].[claim]([ClaimNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimformitem] ADD CONSTRAINT [fk_claimformitem_1_ClaimFormNum] FOREIGN KEY ([ClaimFormNum]) REFERENCES [dbo].[claimform]([ClaimFormNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimpayment] ADD CONSTRAINT [fk_claimpayment_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimpayment] ADD CONSTRAINT [fk_claimpayment_2_DepositNum] FOREIGN KEY ([DepositNum]) REFERENCES [dbo].[deposit]([DepositNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimpayment] ADD CONSTRAINT [fk_claimpayment_3_PayType] FOREIGN KEY ([PayType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimpayment] ADD CONSTRAINT [fk_claimpayment_4_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimpayment] ADD CONSTRAINT [fk_claimpayment_5_PayGroup] FOREIGN KEY ([PayGroup]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_1_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_10_ClaimPaymentTracking] FOREIGN KEY ([ClaimPaymentTracking]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_11_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_2_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [dbo].[claim]([ClaimNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_5_ClaimPaymentNum] FOREIGN KEY ([ClaimPaymentNum]) REFERENCES [dbo].[claimpayment]([ClaimPaymentNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_6_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_8_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [dbo].[inssub]([InsSubNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimproc] ADD CONSTRAINT [fk_claimproc_9_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [dbo].[payplan]([PayPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimsnapshot] ADD CONSTRAINT [fk_claimsnapshot_1_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimsnapshot] ADD CONSTRAINT [fk_claimsnapshot_2_ClaimProcNum] FOREIGN KEY ([ClaimProcNum]) REFERENCES [dbo].[claimproc]([ClaimProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimtracking] ADD CONSTRAINT [fk_claimtracking_1_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [dbo].[claim]([ClaimNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimtracking] ADD CONSTRAINT [fk_claimtracking_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimtracking] ADD CONSTRAINT [fk_claimtracking_3_TrackingDefNum] FOREIGN KEY ([TrackingDefNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimtracking] ADD CONSTRAINT [fk_claimtracking_4_TrackingErrorDefNum] FOREIGN KEY ([TrackingErrorDefNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[claimvalcodelog] ADD CONSTRAINT [fk_claimvalcodelog_1_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [dbo].[claim]([ClaimNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clearinghouse] ADD CONSTRAINT [fk_clearinghouse_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clearinghouse] ADD CONSTRAINT [fk_clearinghouse_2_HqClearinghouseNum] FOREIGN KEY ([HqClearinghouseNum]) REFERENCES [dbo].[clearinghouse]([ClearinghouseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clinic] ADD CONSTRAINT [fk_clinic_1_InsBillingProv] FOREIGN KEY ([InsBillingProv]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clinic] ADD CONSTRAINT [fk_clinic_2_EmailAddressNum] FOREIGN KEY ([EmailAddressNum]) REFERENCES [dbo].[emailaddress]([EmailAddressNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clinic] ADD CONSTRAINT [fk_clinic_3_DefaultProv] FOREIGN KEY ([DefaultProv]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clinic] ADD CONSTRAINT [fk_clinic_4_Region] FOREIGN KEY ([Region]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clinic] ADD CONSTRAINT [fk_clinic_5_MedLabAccountNum] FOREIGN KEY ([MedLabAccountNum]) REFERENCES [dbo].[medlab]([PatAccountNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clinicerx] ADD CONSTRAINT [fk_clinicerx_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clinicerx] ADD CONSTRAINT [fk_clinicerx_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clinicerx] ADD CONSTRAINT [fk_clinicerx_3_RegistrationKeyNum] FOREIGN KEY ([RegistrationKeyNum]) REFERENCES [dbo].[registrationkey]([RegistrationKeyNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clinicpref] ADD CONSTRAINT [fk_clinicpref_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clockevent] ADD CONSTRAINT [fk_clockevent_1_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [dbo].[employee]([EmployeeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[clockevent] ADD CONSTRAINT [fk_clockevent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[cloudaddress] ADD CONSTRAINT [fk_cloudaddress_1_UserNumLastConnect] FOREIGN KEY ([UserNumLastConnect]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[commlog] ADD CONSTRAINT [fk_commlog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[commlog] ADD CONSTRAINT [fk_commlog_2_CommType] FOREIGN KEY ([CommType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[commlog] ADD CONSTRAINT [fk_commlog_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[commlog] ADD CONSTRAINT [fk_commlog_4_ProgramNum] FOREIGN KEY ([ProgramNum]) REFERENCES [dbo].[program]([ProgramNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[commlog] ADD CONSTRAINT [fk_commlog_5_ReferralNum] FOREIGN KEY ([ReferralNum]) REFERENCES [dbo].[referral]([ReferralNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[commoptout] ADD CONSTRAINT [fk_commoptout_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[computerpref] ADD CONSTRAINT [fk_computerpref_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[computerpref] ADD CONSTRAINT [fk_computerpref_2_ApptViewNum] FOREIGN KEY ([ApptViewNum]) REFERENCES [dbo].[apptview]([ApptViewNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[confirmationrequest] ADD CONSTRAINT [fk_confirmationrequest_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[confirmationrequest] ADD CONSTRAINT [fk_confirmationrequest_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[confirmationrequest] ADD CONSTRAINT [fk_confirmationrequest_3_GuidMessageFromMobile] FOREIGN KEY ([GuidMessageFromMobile]) REFERENCES [dbo].[smsfrommobile]([GuidMessage]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[confirmationrequest] ADD CONSTRAINT [fk_confirmationrequest_4_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [dbo].[apptreminderrule]([ApptReminderRuleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[conngroupattach] ADD CONSTRAINT [fk_conngroupattach_1_ConnectionGroupNum] FOREIGN KEY ([ConnectionGroupNum]) REFERENCES [dbo].[connectiongroup]([ConnectionGroupNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[conngroupattach] ADD CONSTRAINT [fk_conngroupattach_2_CentralConnectionNum] FOREIGN KEY ([CentralConnectionNum]) REFERENCES [dbo].[centralconnection]([CentralConnectionNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[contact] ADD CONSTRAINT [fk_contact_1_Category] FOREIGN KEY ([Category]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[covspan] ADD CONSTRAINT [fk_covspan_1_CovCatNum] FOREIGN KEY ([CovCatNum]) REFERENCES [dbo].[covcat]([CovCatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[creditcard] ADD CONSTRAINT [fk_creditcard_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[creditcard] ADD CONSTRAINT [fk_creditcard_2_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [dbo].[payplan]([PayPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[creditcard] ADD CONSTRAINT [fk_creditcard_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[creditcard] ADD CONSTRAINT [fk_creditcard_4_PaymentType] FOREIGN KEY ([PaymentType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[custrefentry] ADD CONSTRAINT [fk_custrefentry_1_PatNumCust] FOREIGN KEY ([PatNumCust]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[custrefentry] ADD CONSTRAINT [fk_custrefentry_2_PatNumRef] FOREIGN KEY ([PatNumRef]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[custreference] ADD CONSTRAINT [fk_custreference_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[dashboardcell] ADD CONSTRAINT [fk_dashboardcell_1_DashboardLayoutNum] FOREIGN KEY ([DashboardLayoutNum]) REFERENCES [dbo].[dashboardlayout]([DashboardLayoutNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[dashboardlayout] ADD CONSTRAINT [fk_dashboardlayout_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[dashboardlayout] ADD CONSTRAINT [fk_dashboardlayout_2_UserGroupNum] FOREIGN KEY ([UserGroupNum]) REFERENCES [dbo].[usergroup]([UserGroupNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[dbmlog] ADD CONSTRAINT [fk_dbmlog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[deflink] ADD CONSTRAINT [fk_deflink_1_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[deposit] ADD CONSTRAINT [fk_deposit_1_DepositAccountNum] FOREIGN KEY ([DepositAccountNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[discountplan] ADD CONSTRAINT [fk_discountplan_1_FeeSchedNum] FOREIGN KEY ([FeeSchedNum]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[discountplan] ADD CONSTRAINT [fk_discountplan_2_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[discountplansub] ADD CONSTRAINT [fk_discountplansub_1_DiscountPlanNum] FOREIGN KEY ([DiscountPlanNum]) REFERENCES [dbo].[discountplan]([DiscountPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[discountplansub] ADD CONSTRAINT [fk_discountplansub_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[disease] ADD CONSTRAINT [fk_disease_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[disease] ADD CONSTRAINT [fk_disease_2_DiseaseDefNum] FOREIGN KEY ([DiseaseDefNum]) REFERENCES [dbo].[diseasedef]([DiseaseDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[disease] ADD CONSTRAINT [fk_disease_3_SnomedProblemType] FOREIGN KEY ([SnomedProblemType]) REFERENCES [dbo].[snomed]([SnomedCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[diseasedef] ADD CONSTRAINT [fk_diseasedef_1_ICD9Code] FOREIGN KEY ([ICD9Code]) REFERENCES [dbo].[icd9]([ICD9Code]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[diseasedef] ADD CONSTRAINT [fk_diseasedef_2_SnomedCode] FOREIGN KEY ([SnomedCode]) REFERENCES [dbo].[snomed]([SnomedCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[diseasedef] ADD CONSTRAINT [fk_diseasedef_3_Icd10Code] FOREIGN KEY ([Icd10Code]) REFERENCES [dbo].[icd10]([Icd10Code]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[displayfield] ADD CONSTRAINT [fk_displayfield_1_ChartViewNum] FOREIGN KEY ([ChartViewNum]) REFERENCES [dbo].[chartview]([ChartViewNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[dispsupply] ADD CONSTRAINT [fk_dispsupply_1_SupplyNum] FOREIGN KEY ([SupplyNum]) REFERENCES [dbo].[supply]([SupplyNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[dispsupply] ADD CONSTRAINT [fk_dispsupply_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[document] ADD CONSTRAINT [fk_document_1_DocCategory] FOREIGN KEY ([DocCategory]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[document] ADD CONSTRAINT [fk_document_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[document] ADD CONSTRAINT [fk_document_3_MountItemNum] FOREIGN KEY ([MountItemNum]) REFERENCES [dbo].[mountitem]([MountItemNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[document] ADD CONSTRAINT [fk_document_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[document] ADD CONSTRAINT [fk_document_5_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[dunning] ADD CONSTRAINT [fk_dunning_1_BillingType] FOREIGN KEY ([BillingType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[dunning] ADD CONSTRAINT [fk_dunning_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ebill] ADD CONSTRAINT [fk_ebill_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eclipboardimagecapture] ADD CONSTRAINT [fk_eclipboardimagecapture_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eclipboardimagecapture] ADD CONSTRAINT [fk_eclipboardimagecapture_2_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eclipboardimagecapture] ADD CONSTRAINT [fk_eclipboardimagecapture_3_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eclipboardimagecapturedef] ADD CONSTRAINT [fk_eclipboardimagecapturedef_1_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eclipboardimagecapturedef] ADD CONSTRAINT [fk_eclipboardimagecapturedef_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eclipboardsheetdef] ADD CONSTRAINT [fk_eclipboardsheetdef_1_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eclipboardsheetdef] ADD CONSTRAINT [fk_eclipboardsheetdef_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eclipboardsheetdef] ADD CONSTRAINT [fk_eclipboardsheetdef_3_EFormDefNum] FOREIGN KEY ([EFormDefNum]) REFERENCES [dbo].[eformdef]([EFormDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eduresource] ADD CONSTRAINT [fk_eduresource_1_DiseaseDefNum] FOREIGN KEY ([DiseaseDefNum]) REFERENCES [dbo].[diseasedef]([DiseaseDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eduresource] ADD CONSTRAINT [fk_eduresource_2_MedicationNum] FOREIGN KEY ([MedicationNum]) REFERENCES [dbo].[medication]([MedicationNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eduresource] ADD CONSTRAINT [fk_eduresource_3_LabResultID] FOREIGN KEY ([LabResultID]) REFERENCES [dbo].[labresult]([TestID]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eduresource] ADD CONSTRAINT [fk_eduresource_4_SmokingSnoMed] FOREIGN KEY ([SmokingSnoMed]) REFERENCES [dbo].[ehrmeasureevent]([CodeValueResult]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eform] ADD CONSTRAINT [fk_eform_1_SaveImageCategory] FOREIGN KEY ([SaveImageCategory]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eformdef] ADD CONSTRAINT [fk_eformdef_1_SaveImageCategory] FOREIGN KEY ([SaveImageCategory]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehramendment] ADD CONSTRAINT [fk_ehramendment_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehraptobs] ADD CONSTRAINT [fk_ehraptobs_1_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrcareplan] ADD CONSTRAINT [fk_ehrcareplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlab] ADD CONSTRAINT [fk_ehrlab_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabclinicalinfo] ADD CONSTRAINT [fk_ehrlabclinicalinfo_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [dbo].[ehrlab]([EhrLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabimage] ADD CONSTRAINT [fk_ehrlabimage_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [dbo].[ehrlab]([EhrLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabimage] ADD CONSTRAINT [fk_ehrlabimage_2_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabnote] ADD CONSTRAINT [fk_ehrlabnote_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [dbo].[ehrlab]([EhrLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabnote] ADD CONSTRAINT [fk_ehrlabnote_2_EhrLabResultNum] FOREIGN KEY ([EhrLabResultNum]) REFERENCES [dbo].[ehrlabresult]([EhrLabResultNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabresult] ADD CONSTRAINT [fk_ehrlabresult_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [dbo].[ehrlab]([EhrLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabresultscopyto] ADD CONSTRAINT [fk_ehrlabresultscopyto_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [dbo].[ehrlab]([EhrLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabspecimen] ADD CONSTRAINT [fk_ehrlabspecimen_1_EhrLabNum] FOREIGN KEY ([EhrLabNum]) REFERENCES [dbo].[ehrlab]([EhrLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabspecimencondition] ADD CONSTRAINT [fk_ehrlabspecimencondition_1_EhrLabSpecimenNum] FOREIGN KEY ([EhrLabSpecimenNum]) REFERENCES [dbo].[ehrlabspecimen]([EhrLabSpecimenNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrlabspecimenrejectreason] ADD CONSTRAINT [fk_ehrlabspecimenrejectreason_1_EhrLabSpecimenNum] FOREIGN KEY ([EhrLabSpecimenNum]) REFERENCES [dbo].[ehrlab]([EhrLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrmeasureevent] ADD CONSTRAINT [fk_ehrmeasureevent_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_3_CodeSystem] FOREIGN KEY ([CodeSystem]) REFERENCES [dbo].[codesystem]([CodeSystemName]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_4_CodeValueReason] FOREIGN KEY ([CodeValueReason]) REFERENCES [dbo].[ehrcode]([CodeValue]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrnotperformed] ADD CONSTRAINT [fk_ehrnotperformed_5_CodeSystemReason] FOREIGN KEY ([CodeSystemReason]) REFERENCES [dbo].[codesystem]([CodeSystemName]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrpatient] ADD CONSTRAINT [fk_ehrpatient_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrprovkey] ADD CONSTRAINT [fk_ehrprovkey_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrquarterlykey] ADD CONSTRAINT [fk_ehrquarterlykey_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrsummaryccd] ADD CONSTRAINT [fk_ehrsummaryccd_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ehrsummaryccd] ADD CONSTRAINT [fk_ehrsummaryccd_2_EmailAttachNum] FOREIGN KEY ([EmailAttachNum]) REFERENCES [dbo].[emailattach]([EmailAttachNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailaddress] ADD CONSTRAINT [fk_emailaddress_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailattach] ADD CONSTRAINT [fk_emailattach_1_EmailMessageNum] FOREIGN KEY ([EmailMessageNum]) REFERENCES [dbo].[emailmessage]([EmailMessageNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailattach] ADD CONSTRAINT [fk_emailattach_2_EmailTemplateNum] FOREIGN KEY ([EmailTemplateNum]) REFERENCES [dbo].[emailtemplate]([EmailTemplateNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailhostingtemplate] ADD CONSTRAINT [fk_emailhostingtemplate_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailmessage] ADD CONSTRAINT [fk_emailmessage_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailmessage] ADD CONSTRAINT [fk_emailmessage_2_ProvNumWebMail] FOREIGN KEY ([ProvNumWebMail]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailmessage] ADD CONSTRAINT [fk_emailmessage_3_PatNumSubj] FOREIGN KEY ([PatNumSubj]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailmessage] ADD CONSTRAINT [fk_emailmessage_4_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailmessage] ADD CONSTRAINT [fk_emailmessage_5_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailsecure] ADD CONSTRAINT [fk_emailsecure_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailsecure] ADD CONSTRAINT [fk_emailsecure_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailsecure] ADD CONSTRAINT [fk_emailsecure_3_EmailMessageNum] FOREIGN KEY ([EmailMessageNum]) REFERENCES [dbo].[emailmessage]([EmailMessageNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailsecureattach] ADD CONSTRAINT [fk_emailsecureattach_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailsecureattach] ADD CONSTRAINT [fk_emailsecureattach_2_EmailAttachNum] FOREIGN KEY ([EmailAttachNum]) REFERENCES [dbo].[emailattach]([EmailAttachNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[emailsecureattach] ADD CONSTRAINT [fk_emailsecureattach_3_EmailSecureNum] FOREIGN KEY ([EmailSecureNum]) REFERENCES [dbo].[emailsecure]([EmailSecureNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employee] ADD CONSTRAINT [fk_employee_1_ReportsTo] FOREIGN KEY ([ReportsTo]) REFERENCES [dbo].[employee]([EmployeeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[encounter] ADD CONSTRAINT [fk_encounter_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[encounter] ADD CONSTRAINT [fk_encounter_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[encounter] ADD CONSTRAINT [fk_encounter_3_CodeValue] FOREIGN KEY ([CodeValue]) REFERENCES [dbo].[ehrcode]([CodeValue]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[encounter] ADD CONSTRAINT [fk_encounter_4_CodeSystem] FOREIGN KEY ([CodeSystem]) REFERENCES [dbo].[codesystem]([CodeSystemName]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[entrylog] ADD CONSTRAINT [fk_entrylog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eobattach] ADD CONSTRAINT [fk_eobattach_1_ClaimPaymentNum] FOREIGN KEY ([ClaimPaymentNum]) REFERENCES [dbo].[claimpayment]([ClaimPaymentNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eobattach] ADD CONSTRAINT [fk_eobattach_2_ClaimNumPreAuth] FOREIGN KEY ([ClaimNumPreAuth]) REFERENCES [dbo].[claim]([ClaimNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[equipment] ADD CONSTRAINT [fk_equipment_1_ProvNumCheckedOut] FOREIGN KEY ([ProvNumCheckedOut]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[erouting] ADD CONSTRAINT [fk_erouting_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[erouting] ADD CONSTRAINT [fk_erouting_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eroutingaction] ADD CONSTRAINT [fk_eroutingaction_1_ERoutingNum] FOREIGN KEY ([ERoutingNum]) REFERENCES [dbo].[erouting]([ERoutingNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eroutingaction] ADD CONSTRAINT [fk_eroutingaction_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eroutingactiondef] ADD CONSTRAINT [fk_eroutingactiondef_1_ERoutingDefNum] FOREIGN KEY ([ERoutingDefNum]) REFERENCES [dbo].[eroutingdef]([ERoutingDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eroutingdef] ADD CONSTRAINT [fk_eroutingdef_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eroutingdef] ADD CONSTRAINT [fk_eroutingdef_2_UserNumCreated] FOREIGN KEY ([UserNumCreated]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eroutingdef] ADD CONSTRAINT [fk_eroutingdef_3_UserNumModified] FOREIGN KEY ([UserNumModified]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eroutingdeflink] ADD CONSTRAINT [fk_eroutingdeflink_1_ERoutingDefNum] FOREIGN KEY ([ERoutingDefNum]) REFERENCES [dbo].[eroutingdef]([ERoutingDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[erxlog] ADD CONSTRAINT [fk_erxlog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[erxlog] ADD CONSTRAINT [fk_erxlog_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[erxlog] ADD CONSTRAINT [fk_erxlog_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[eservicelog] ADD CONSTRAINT [fk_eservicelog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_1_ClearingHouseNum] FOREIGN KEY ([ClearingHouseNum]) REFERENCES [dbo].[clearinghouse]([ClearinghouseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_10_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_2_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [dbo].[claim]([ClaimNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_3_CarrierNum] FOREIGN KEY ([CarrierNum]) REFERENCES [dbo].[carrier]([CarrierNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_4_CarrierNum2] FOREIGN KEY ([CarrierNum2]) REFERENCES [dbo].[carrier]([CarrierNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_5_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_6_EtransMessageTextNum] FOREIGN KEY ([EtransMessageTextNum]) REFERENCES [dbo].[etransmessagetext]([EtransMessageTextNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_7_AckEtransNum] FOREIGN KEY ([AckEtransNum]) REFERENCES [dbo].[etrans]([EtransNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_8_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans] ADD CONSTRAINT [fk_etrans_9_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [dbo].[inssub]([InsSubNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans835] ADD CONSTRAINT [fk_etrans835_1_EtransNum] FOREIGN KEY ([EtransNum]) REFERENCES [dbo].[etrans]([EtransNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans835attach] ADD CONSTRAINT [fk_etrans835attach_1_EtransNum] FOREIGN KEY ([EtransNum]) REFERENCES [dbo].[etrans]([EtransNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[etrans835attach] ADD CONSTRAINT [fk_etrans835attach_2_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [dbo].[claim]([ClaimNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[evaluation] ADD CONSTRAINT [fk_evaluation_1_InstructNum] FOREIGN KEY ([InstructNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[evaluation] ADD CONSTRAINT [fk_evaluation_2_StudentNum] FOREIGN KEY ([StudentNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[evaluation] ADD CONSTRAINT [fk_evaluation_3_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [dbo].[schoolcourse]([SchoolCourseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[evaluationcriterion] ADD CONSTRAINT [fk_evaluationcriterion_1_EvaluationNum] FOREIGN KEY ([EvaluationNum]) REFERENCES [dbo].[evaluation]([EvaluationNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[evaluationcriteriondef] ADD CONSTRAINT [fk_evaluationcriteriondef_1_EvaluationDefNum] FOREIGN KEY ([EvaluationDefNum]) REFERENCES [dbo].[evaluationdef]([EvaluationDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[evaluationdef] ADD CONSTRAINT [fk_evaluationdef_1_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [dbo].[schoolcourse]([SchoolCourseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[evaluationdef] ADD CONSTRAINT [fk_evaluationdef_2_SchoolCourseDefNum] FOREIGN KEY ([SchoolCourseDefNum]) REFERENCES [dbo].[schoolcoursedef]([SchoolCourseDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[famaging] ADD CONSTRAINT [fk_famaging_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[familyhealth] ADD CONSTRAINT [fk_familyhealth_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[familyhealth] ADD CONSTRAINT [fk_familyhealth_2_DiseaseDefNum] FOREIGN KEY ([DiseaseDefNum]) REFERENCES [dbo].[diseasedef]([DiseaseDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fee] ADD CONSTRAINT [fk_fee_1_FeeSched] FOREIGN KEY ([FeeSched]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fee] ADD CONSTRAINT [fk_fee_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fee] ADD CONSTRAINT [fk_fee_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fee] ADD CONSTRAINT [fk_fee_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fee] ADD CONSTRAINT [fk_fee_5_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[feesched] ADD CONSTRAINT [fk_feesched_1_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[feeschedgroup] ADD CONSTRAINT [fk_feeschedgroup_1_FeeSchedNum] FOREIGN KEY ([FeeSchedNum]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[feeschednote] ADD CONSTRAINT [fk_feeschednote_1_FeeSchedNum] FOREIGN KEY ([FeeSchedNum]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[feeschednote] ADD CONSTRAINT [fk_feeschednote_2_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[fhircontactpoint] ADD CONSTRAINT [fk_fhircontactpoint_1_FHIRSubscriptionNum] FOREIGN KEY ([FHIRSubscriptionNum]) REFERENCES [dbo].[fhirsubscription]([FHIRSubscriptionNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[formpat] ADD CONSTRAINT [fk_formpat_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[gradingscaleitem] ADD CONSTRAINT [fk_gradingscaleitem_1_GradingScaleNum] FOREIGN KEY ([GradingScaleNum]) REFERENCES [dbo].[gradingscale]([GradingScaleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[grouppermission] ADD CONSTRAINT [fk_grouppermission_1_UserGroupNum] FOREIGN KEY ([UserGroupNum]) REFERENCES [dbo].[usergroup]([UserGroupNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[guardian] ADD CONSTRAINT [fk_guardian_1_PatNumChild] FOREIGN KEY ([PatNumChild]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[guardian] ADD CONSTRAINT [fk_guardian_2_PatNumGuardian] FOREIGN KEY ([PatNumGuardian]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hieclinic] ADD CONSTRAINT [fk_hieclinic_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hiequeue] ADD CONSTRAINT [fk_hiequeue_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[histappointment] ADD CONSTRAINT [fk_histappointment_1_HistUserNum] FOREIGN KEY ([HistUserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hl7def] ADD CONSTRAINT [fk_hl7def_1_LabResultImageCat] FOREIGN KEY ([LabResultImageCat]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hl7deffield] ADD CONSTRAINT [fk_hl7deffield_1_HL7DefSegmentNum] FOREIGN KEY ([HL7DefSegmentNum]) REFERENCES [dbo].[hl7defsegment]([HL7DefSegmentNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hl7defmessage] ADD CONSTRAINT [fk_hl7defmessage_1_HL7DefNum] FOREIGN KEY ([HL7DefNum]) REFERENCES [dbo].[hl7def]([HL7DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hl7defsegment] ADD CONSTRAINT [fk_hl7defsegment_1_HL7DefMessageNum] FOREIGN KEY ([HL7DefMessageNum]) REFERENCES [dbo].[hl7defmessage]([HL7DefMessageNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hl7msg] ADD CONSTRAINT [fk_hl7msg_1_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hl7msg] ADD CONSTRAINT [fk_hl7msg_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hl7procattach] ADD CONSTRAINT [fk_hl7procattach_1_HL7MsgNum] FOREIGN KEY ([HL7MsgNum]) REFERENCES [dbo].[hl7msg]([HL7MsgNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[hl7procattach] ADD CONSTRAINT [fk_hl7procattach_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imagedraw] ADD CONSTRAINT [fk_imagedraw_1_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imagedraw] ADD CONSTRAINT [fk_imagedraw_2_MountNum] FOREIGN KEY ([MountNum]) REFERENCES [dbo].[mount]([MountNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insbluebook] ADD CONSTRAINT [fk_insbluebook_1_ProcCodeNum] FOREIGN KEY ([ProcCodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insbluebook] ADD CONSTRAINT [fk_insbluebook_2_CarrierNum] FOREIGN KEY ([CarrierNum]) REFERENCES [dbo].[carrier]([CarrierNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insbluebook] ADD CONSTRAINT [fk_insbluebook_3_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insbluebook] ADD CONSTRAINT [fk_insbluebook_4_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insbluebook] ADD CONSTRAINT [fk_insbluebook_5_ClaimNum] FOREIGN KEY ([ClaimNum]) REFERENCES [dbo].[claim]([ClaimNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insbluebooklog] ADD CONSTRAINT [fk_insbluebooklog_1_ClaimProcNum] FOREIGN KEY ([ClaimProcNum]) REFERENCES [dbo].[claimproc]([ClaimProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inseditlog] ADD CONSTRAINT [fk_inseditlog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inseditpatlog] ADD CONSTRAINT [fk_inseditpatlog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insfilingcode] ADD CONSTRAINT [fk_insfilingcode_1_GroupType] FOREIGN KEY ([GroupType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insfilingcodesubtype] ADD CONSTRAINT [fk_insfilingcodesubtype_1_InsFilingCodeNum] FOREIGN KEY ([InsFilingCodeNum]) REFERENCES [dbo].[insfilingcode]([InsFilingCodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inspending] ADD CONSTRAINT [fk_inspending_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inspending] ADD CONSTRAINT [fk_inspending_2_PatNumSubscriber] FOREIGN KEY ([PatNumSubscriber]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_1_FeeSched] FOREIGN KEY ([FeeSched]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_10_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_11_BillingType] FOREIGN KEY ([BillingType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_12_ManualFeeSchedNum] FOREIGN KEY ([ManualFeeSchedNum]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_2_ClaimFormNum] FOREIGN KEY ([ClaimFormNum]) REFERENCES [dbo].[claimform]([ClaimFormNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_3_CopayFeeSched] FOREIGN KEY ([CopayFeeSched]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_4_EmployerNum] FOREIGN KEY ([EmployerNum]) REFERENCES [dbo].[employer]([EmployerNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_5_CarrierNum] FOREIGN KEY ([CarrierNum]) REFERENCES [dbo].[carrier]([CarrierNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_6_AllowedFeeSched] FOREIGN KEY ([AllowedFeeSched]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_7_FilingCode] FOREIGN KEY ([FilingCode]) REFERENCES [dbo].[insfilingcode]([InsFilingCodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_8_FilingCodeSubtype] FOREIGN KEY ([FilingCodeSubtype]) REFERENCES [dbo].[insfilingcodesubtype]([InsFilingCodeSubtypeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplan] ADD CONSTRAINT [fk_insplan_9_SopCode] FOREIGN KEY ([SopCode]) REFERENCES [dbo].[sop]([SopCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insplanpreference] ADD CONSTRAINT [fk_insplanpreference_1_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inssub] ADD CONSTRAINT [fk_inssub_1_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inssub] ADD CONSTRAINT [fk_inssub_2_Subscriber] FOREIGN KEY ([Subscriber]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inssub] ADD CONSTRAINT [fk_inssub_3_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[installmentplan] ADD CONSTRAINT [fk_installmentplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insverify] ADD CONSTRAINT [fk_insverify_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insverify] ADD CONSTRAINT [fk_insverify_2_DefNum] FOREIGN KEY ([DefNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[insverifyhist] ADD CONSTRAINT [fk_insverifyhist_1_VerifyUserNum] FOREIGN KEY ([VerifyUserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[intervention] ADD CONSTRAINT [fk_intervention_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[intervention] ADD CONSTRAINT [fk_intervention_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[intervention] ADD CONSTRAINT [fk_intervention_3_CodeValue] FOREIGN KEY ([CodeValue]) REFERENCES [dbo].[ehrcode]([CodeValue]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[intervention] ADD CONSTRAINT [fk_intervention_4_CodeSystem] FOREIGN KEY ([CodeSystem]) REFERENCES [dbo].[codesystem]([CodeSystemName]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[journalentry] ADD CONSTRAINT [fk_journalentry_1_TransactionNum] FOREIGN KEY ([TransactionNum]) REFERENCES [dbo].[transaction]([TransactionNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[journalentry] ADD CONSTRAINT [fk_journalentry_2_AccountNum] FOREIGN KEY ([AccountNum]) REFERENCES [dbo].[account]([AccountNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[journalentry] ADD CONSTRAINT [fk_journalentry_3_ReconcileNum] FOREIGN KEY ([ReconcileNum]) REFERENCES [dbo].[reconcile]([ReconcileNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[journalentry] ADD CONSTRAINT [fk_journalentry_4_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[journalentry] ADD CONSTRAINT [fk_journalentry_5_SecUserNumEdit] FOREIGN KEY ([SecUserNumEdit]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labcase] ADD CONSTRAINT [fk_labcase_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labcase] ADD CONSTRAINT [fk_labcase_2_LaboratoryNum] FOREIGN KEY ([LaboratoryNum]) REFERENCES [dbo].[laboratory]([LaboratoryNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labcase] ADD CONSTRAINT [fk_labcase_3_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labcase] ADD CONSTRAINT [fk_labcase_4_PlannedAptNum] FOREIGN KEY ([PlannedAptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labcase] ADD CONSTRAINT [fk_labcase_5_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[laboratory] ADD CONSTRAINT [fk_laboratory_1_Slip] FOREIGN KEY ([Slip]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labpanel] ADD CONSTRAINT [fk_labpanel_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labpanel] ADD CONSTRAINT [fk_labpanel_2_MedicalOrderNum] FOREIGN KEY ([MedicalOrderNum]) REFERENCES [dbo].[medicalorder]([MedicalOrderNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labresult] ADD CONSTRAINT [fk_labresult_1_LabPanelNum] FOREIGN KEY ([LabPanelNum]) REFERENCES [dbo].[labpanel]([LabPanelNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labresult] ADD CONSTRAINT [fk_labresult_2_ObsUnits] FOREIGN KEY ([ObsUnits]) REFERENCES [dbo].[drugunit]([UnitText]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[labturnaround] ADD CONSTRAINT [fk_labturnaround_1_LaboratoryNum] FOREIGN KEY ([LaboratoryNum]) REFERENCES [dbo].[laboratory]([LaboratoryNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[languagepat] ADD CONSTRAINT [fk_languagepat_2_EFormFieldDefNum] FOREIGN KEY ([EFormFieldDefNum]) REFERENCES [dbo].[eformfielddef]([EFormFieldDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[lettermerge] ADD CONSTRAINT [fk_lettermerge_1_Category] FOREIGN KEY ([Category]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[lettermerge] ADD CONSTRAINT [fk_lettermerge_2_ImageFolder] FOREIGN KEY ([ImageFolder]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[lettermergefield] ADD CONSTRAINT [fk_lettermergefield_1_LetterMergeNum] FOREIGN KEY ([LetterMergeNum]) REFERENCES [dbo].[lettermerge]([LetterMergeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medicalorder] ADD CONSTRAINT [fk_medicalorder_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medicalorder] ADD CONSTRAINT [fk_medicalorder_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medication] ADD CONSTRAINT [fk_medication_1_GenericNum] FOREIGN KEY ([GenericNum]) REFERENCES [dbo].[medication]([MedicationNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medicationpat] ADD CONSTRAINT [fk_medicationpat_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medicationpat] ADD CONSTRAINT [fk_medicationpat_2_MedicationNum] FOREIGN KEY ([MedicationNum]) REFERENCES [dbo].[medication]([MedicationNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medicationpat] ADD CONSTRAINT [fk_medicationpat_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medlab] ADD CONSTRAINT [fk_medlab_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medlab] ADD CONSTRAINT [fk_medlab_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medlabfacattach] ADD CONSTRAINT [fk_medlabfacattach_1_MedLabNum] FOREIGN KEY ([MedLabNum]) REFERENCES [dbo].[medlab]([MedLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medlabfacattach] ADD CONSTRAINT [fk_medlabfacattach_2_MedLabResultNum] FOREIGN KEY ([MedLabResultNum]) REFERENCES [dbo].[medlabresult]([MedLabResultNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medlabfacattach] ADD CONSTRAINT [fk_medlabfacattach_3_MedLabFacilityNum] FOREIGN KEY ([MedLabFacilityNum]) REFERENCES [dbo].[medlabfacility]([MedLabFacilityNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medlabresult] ADD CONSTRAINT [fk_medlabresult_1_MedLabNum] FOREIGN KEY ([MedLabNum]) REFERENCES [dbo].[medlab]([MedLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medlabresult] ADD CONSTRAINT [fk_medlabresult_2_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[medlabspecimen] ADD CONSTRAINT [fk_medlabspecimen_1_MedLabNum] FOREIGN KEY ([MedLabNum]) REFERENCES [dbo].[medlab]([MedLabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mobileappdevice] ADD CONSTRAINT [fk_mobileappdevice_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mobileappdevice] ADD CONSTRAINT [fk_mobileappdevice_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mobileappdevice] ADD CONSTRAINT [fk_mobileappdevice_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mobilebrandingprofile] ADD CONSTRAINT [fk_mobilebrandingprofile_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mount] ADD CONSTRAINT [fk_mount_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mount] ADD CONSTRAINT [fk_mount_2_DocCategory] FOREIGN KEY ([DocCategory]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mount] ADD CONSTRAINT [fk_mount_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mountdef] ADD CONSTRAINT [fk_mountdef_1_DefaultCat] FOREIGN KEY ([DefaultCat]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mountitem] ADD CONSTRAINT [fk_mountitem_1_MountNum] FOREIGN KEY ([MountNum]) REFERENCES [dbo].[mount]([MountNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[mountitemdef] ADD CONSTRAINT [fk_mountitemdef_1_MountDefNum] FOREIGN KEY ([MountDefNum]) REFERENCES [dbo].[mountdef]([MountDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_3_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [dbo].[apptreminderrule]([ApptReminderRuleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_4_ApptNum] FOREIGN KEY ([ApptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[msgtopaysent] ADD CONSTRAINT [fk_msgtopaysent_5_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [dbo].[statement]([StatementNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[oidexternal] ADD CONSTRAINT [fk_oidexternal_1_IDInternal] FOREIGN KEY ([IDInternal]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[operatory] ADD CONSTRAINT [fk_operatory_1_ProvDentist] FOREIGN KEY ([ProvDentist]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[operatory] ADD CONSTRAINT [fk_operatory_2_ProvHygienist] FOREIGN KEY ([ProvHygienist]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[operatory] ADD CONSTRAINT [fk_operatory_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[operatory] ADD CONSTRAINT [fk_operatory_4_OperatoryType] FOREIGN KEY ([OperatoryType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthocase] ADD CONSTRAINT [fk_orthocase_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthocase] ADD CONSTRAINT [fk_orthocase_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthocase] ADD CONSTRAINT [fk_orthocase_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthocase] ADD CONSTRAINT [fk_orthocase_4_OrthoType] FOREIGN KEY ([OrthoType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthocase] ADD CONSTRAINT [fk_orthocase_5_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochart] ADD CONSTRAINT [fk_orthochart_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochart] ADD CONSTRAINT [fk_orthochart_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochart] ADD CONSTRAINT [fk_orthochart_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochart] ADD CONSTRAINT [fk_orthochart_4_OrthoChartRowNum] FOREIGN KEY ([OrthoChartRowNum]) REFERENCES [dbo].[orthochartrow]([OrthoChartRowNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochartlog] ADD CONSTRAINT [fk_orthochartlog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochartlog] ADD CONSTRAINT [fk_orthochartlog_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochartlog] ADD CONSTRAINT [fk_orthochartlog_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochartlog] ADD CONSTRAINT [fk_orthochartlog_4_OrthoChartRowNum] FOREIGN KEY ([OrthoChartRowNum]) REFERENCES [dbo].[orthochartrow]([OrthoChartRowNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochartrow] ADD CONSTRAINT [fk_orthochartrow_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochartrow] ADD CONSTRAINT [fk_orthochartrow_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthochartrow] ADD CONSTRAINT [fk_orthochartrow_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthocharttab] ADD CONSTRAINT [fk_orthocharttab_1_OrthoChartTabNum] FOREIGN KEY ([OrthoChartTabNum]) REFERENCES [dbo].[orthocharttab]([OrthoChartTabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthocharttablink] ADD CONSTRAINT [fk_orthocharttablink_1_OrthoChartTabNum] FOREIGN KEY ([OrthoChartTabNum]) REFERENCES [dbo].[orthocharttab]([OrthoChartTabNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthocharttablink] ADD CONSTRAINT [fk_orthocharttablink_2_DisplayFieldNum] FOREIGN KEY ([DisplayFieldNum]) REFERENCES [dbo].[displayfield]([DisplayFieldNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthohardware] ADD CONSTRAINT [fk_orthohardware_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthohardware] ADD CONSTRAINT [fk_orthohardware_2_OrthoHardwareSpecNum] FOREIGN KEY ([OrthoHardwareSpecNum]) REFERENCES [dbo].[orthohardwarespec]([OrthoHardwareSpecNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthoplanlink] ADD CONSTRAINT [fk_orthoplanlink_1_OrthoCaseNum] FOREIGN KEY ([OrthoCaseNum]) REFERENCES [dbo].[orthocase]([OrthoCaseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthoplanlink] ADD CONSTRAINT [fk_orthoplanlink_2_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthoproclink] ADD CONSTRAINT [fk_orthoproclink_1_OrthoCaseNum] FOREIGN KEY ([OrthoCaseNum]) REFERENCES [dbo].[orthocase]([OrthoCaseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthoproclink] ADD CONSTRAINT [fk_orthoproclink_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthoproclink] ADD CONSTRAINT [fk_orthoproclink_3_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orthorx] ADD CONSTRAINT [fk_orthorx_1_OrthoHardwareSpecNum] FOREIGN KEY ([OrthoHardwareSpecNum]) REFERENCES [dbo].[orthohardwarespec]([OrthoHardwareSpecNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patfield] ADD CONSTRAINT [fk_patfield_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patfield] ADD CONSTRAINT [fk_patfield_2_FieldName] FOREIGN KEY ([FieldName]) REFERENCES [dbo].[patfielddef]([FieldName]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patfield] ADD CONSTRAINT [fk_patfield_3_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patfieldpickitem] ADD CONSTRAINT [fk_patfieldpickitem_1_PatFieldDefNum] FOREIGN KEY ([PatFieldDefNum]) REFERENCES [dbo].[patfielddef]([PatFieldDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_1_Guarantor] FOREIGN KEY ([Guarantor]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_10_ResponsParty] FOREIGN KEY ([ResponsParty]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_11_SuperFamily] FOREIGN KEY ([SuperFamily]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_12_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_13_DiscountPlanNum] FOREIGN KEY ([DiscountPlanNum]) REFERENCES [dbo].[discountplan]([DiscountPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_2_PriProv] FOREIGN KEY ([PriProv]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_3_SecProv] FOREIGN KEY ([SecProv]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_4_FeeSched] FOREIGN KEY ([FeeSched]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_5_BillingType] FOREIGN KEY ([BillingType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_6_EmployerNum] FOREIGN KEY ([EmployerNum]) REFERENCES [dbo].[employer]([EmployerNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_7_County] FOREIGN KEY ([County]) REFERENCES [dbo].[county]([CountyName]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_8_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patient] ADD CONSTRAINT [fk_patient_9_SiteNum] FOREIGN KEY ([SiteNum]) REFERENCES [dbo].[site]([SiteNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patientlink] ADD CONSTRAINT [fk_patientlink_1_PatNumFrom] FOREIGN KEY ([PatNumFrom]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patientlink] ADD CONSTRAINT [fk_patientlink_2_PatNumTo] FOREIGN KEY ([PatNumTo]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patientnote] ADD CONSTRAINT [fk_patientnote_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patientnote] ADD CONSTRAINT [fk_patientnote_2_UserNumOrthoLocked] FOREIGN KEY ([UserNumOrthoLocked]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patientportalinvite] ADD CONSTRAINT [fk_patientportalinvite_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patientportalinvite] ADD CONSTRAINT [fk_patientportalinvite_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patientportalinvite] ADD CONSTRAINT [fk_patientportalinvite_3_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [dbo].[apptreminderrule]([ApptReminderRuleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patientrace] ADD CONSTRAINT [fk_patientrace_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patientrace] ADD CONSTRAINT [fk_patientrace_2_CdcrecCode] FOREIGN KEY ([CdcrecCode]) REFERENCES [dbo].[cdcrec]([CdcrecCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patplan] ADD CONSTRAINT [fk_patplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patplan] ADD CONSTRAINT [fk_patplan_2_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [dbo].[inssub]([InsSubNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[patrestriction] ADD CONSTRAINT [fk_patrestriction_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payconnectresponseweb] ADD CONSTRAINT [fk_payconnectresponseweb_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payconnectresponseweb] ADD CONSTRAINT [fk_payconnectresponseweb_2_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [dbo].[payment]([PayNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payment] ADD CONSTRAINT [fk_payment_1_PayType] FOREIGN KEY ([PayType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payment] ADD CONSTRAINT [fk_payment_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payment] ADD CONSTRAINT [fk_payment_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payment] ADD CONSTRAINT [fk_payment_4_DepositNum] FOREIGN KEY ([DepositNum]) REFERENCES [dbo].[deposit]([DepositNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payment] ADD CONSTRAINT [fk_payment_5_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payortype] ADD CONSTRAINT [fk_payortype_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payortype] ADD CONSTRAINT [fk_payortype_2_SopCode] FOREIGN KEY ([SopCode]) REFERENCES [dbo].[sop]([SopCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplan] ADD CONSTRAINT [fk_payplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplan] ADD CONSTRAINT [fk_payplan_2_Guarantor] FOREIGN KEY ([Guarantor]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplan] ADD CONSTRAINT [fk_payplan_3_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplan] ADD CONSTRAINT [fk_payplan_4_InsSubNum] FOREIGN KEY ([InsSubNum]) REFERENCES [dbo].[inssub]([InsSubNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplan] ADD CONSTRAINT [fk_payplan_5_PlanCategory] FOREIGN KEY ([PlanCategory]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplan] ADD CONSTRAINT [fk_payplan_6_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplancharge] ADD CONSTRAINT [fk_payplancharge_1_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [dbo].[payplan]([PayPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplancharge] ADD CONSTRAINT [fk_payplancharge_2_Guarantor] FOREIGN KEY ([Guarantor]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplancharge] ADD CONSTRAINT [fk_payplancharge_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplancharge] ADD CONSTRAINT [fk_payplancharge_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplancharge] ADD CONSTRAINT [fk_payplancharge_5_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplancharge] ADD CONSTRAINT [fk_payplancharge_6_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplancharge] ADD CONSTRAINT [fk_payplancharge_7_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [dbo].[statement]([StatementNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplanlink] ADD CONSTRAINT [fk_payplanlink_1_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [dbo].[payplan]([PayPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplantemplate] ADD CONSTRAINT [fk_payplantemplate_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payplantemplate] ADD CONSTRAINT [fk_payplantemplate_2_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_10_PayPlanChargeNum] FOREIGN KEY ([PayPlanChargeNum]) REFERENCES [dbo].[payplancharge]([PayPlanChargeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_2_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [dbo].[payment]([PayNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_4_PayPlanNum] FOREIGN KEY ([PayPlanNum]) REFERENCES [dbo].[payplan]([PayPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_5_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_6_UnearnedType] FOREIGN KEY ([UnearnedType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_8_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysplit] ADD CONSTRAINT [fk_paysplit_9_AdjNum] FOREIGN KEY ([AdjNum]) REFERENCES [dbo].[adjustment]([AdjNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysuitepayment] ADD CONSTRAINT [fk_paysuitepayment_1_PaySuitePaymentDetailNum] FOREIGN KEY ([PaySuitePaymentDetailNum]) REFERENCES [dbo].[paysuitepaymentdetail]([PaySuitePaymentDetailNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[paysuitepayment] ADD CONSTRAINT [fk_paysuitepayment_2_ClaimPaymentNum] FOREIGN KEY ([ClaimPaymentNum]) REFERENCES [dbo].[claimpayment]([ClaimPaymentNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payterminal] ADD CONSTRAINT [fk_payterminal_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[pearlrequest] ADD CONSTRAINT [fk_pearlrequest_1_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[perioexam] ADD CONSTRAINT [fk_perioexam_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[perioexam] ADD CONSTRAINT [fk_perioexam_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[periomeasure] ADD CONSTRAINT [fk_periomeasure_1_PerioExamNum] FOREIGN KEY ([PerioExamNum]) REFERENCES [dbo].[perioexam]([PerioExamNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[pharmclinic] ADD CONSTRAINT [fk_pharmclinic_1_PharmacyNum] FOREIGN KEY ([PharmacyNum]) REFERENCES [dbo].[pharmacy]([PharmacyNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[pharmclinic] ADD CONSTRAINT [fk_pharmclinic_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[phonenumber] ADD CONSTRAINT [fk_phonenumber_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[popup] ADD CONSTRAINT [fk_popup_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[popup] ADD CONSTRAINT [fk_popup_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[printer] ADD CONSTRAINT [fk_printer_1_ComputerNum] FOREIGN KEY ([ComputerNum]) REFERENCES [dbo].[computer]([ComputerNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procbutton] ADD CONSTRAINT [fk_procbutton_1_Category] FOREIGN KEY ([Category]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procbuttonitem] ADD CONSTRAINT [fk_procbuttonitem_1_ProcButtonNum] FOREIGN KEY ([ProcButtonNum]) REFERENCES [dbo].[procbutton]([ProcButtonNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procbuttonitem] ADD CONSTRAINT [fk_procbuttonitem_2_AutoCodeNum] FOREIGN KEY ([AutoCodeNum]) REFERENCES [dbo].[autocode]([AutoCodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procbuttonitem] ADD CONSTRAINT [fk_procbuttonitem_3_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procbuttonquick] ADD CONSTRAINT [fk_procbuttonquick_1_CodeValue] FOREIGN KEY ([CodeValue]) REFERENCES [dbo].[procedurecode]([ProcCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proccodenote] ADD CONSTRAINT [fk_proccodenote_1_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proccodenote] ADD CONSTRAINT [fk_proccodenote_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurecode] ADD CONSTRAINT [fk_procedurecode_1_ProcCat] FOREIGN KEY ([ProcCat]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurecode] ADD CONSTRAINT [fk_procedurecode_2_MedicalCode] FOREIGN KEY ([MedicalCode]) REFERENCES [dbo].[procedurecode]([ProcCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurecode] ADD CONSTRAINT [fk_procedurecode_3_SubstitutionCode] FOREIGN KEY ([SubstitutionCode]) REFERENCES [dbo].[procedurecode]([ProcCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurecode] ADD CONSTRAINT [fk_procedurecode_4_ProvNumDefault] FOREIGN KEY ([ProvNumDefault]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_10_BillingTypeOne] FOREIGN KEY ([BillingTypeOne]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_11_BillingTypeTwo] FOREIGN KEY ([BillingTypeTwo]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_12_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_13_SiteNum] FOREIGN KEY ([SiteNum]) REFERENCES [dbo].[site]([SiteNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_14_Prognosis] FOREIGN KEY ([Prognosis]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_15_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [dbo].[statement]([StatementNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_16_RepeatChargeNum] FOREIGN KEY ([RepeatChargeNum]) REFERENCES [dbo].[repeatcharge]([RepeatChargeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_17_ProvOrderOverride] FOREIGN KEY ([ProvOrderOverride]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_18_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_19_OrderingReferralNum] FOREIGN KEY ([OrderingReferralNum]) REFERENCES [dbo].[referral]([ReferralNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_2_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_3_Priority] FOREIGN KEY ([Priority]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_5_Dx] FOREIGN KEY ([Dx]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_6_PlannedAptNum] FOREIGN KEY ([PlannedAptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_8_MedicalCode] FOREIGN KEY ([MedicalCode]) REFERENCES [dbo].[procedurecode]([ProcCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procedurelog] ADD CONSTRAINT [fk_procedurelog_9_ProcNumLab] FOREIGN KEY ([ProcNumLab]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procgroupitem] ADD CONSTRAINT [fk_procgroupitem_1_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procgroupitem] ADD CONSTRAINT [fk_procgroupitem_2_GroupNum] FOREIGN KEY ([GroupNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procmultivisit] ADD CONSTRAINT [fk_procmultivisit_1_GroupProcMultiVisitNum] FOREIGN KEY ([GroupProcMultiVisitNum]) REFERENCES [dbo].[procmultivisit]([ProcMultiVisitNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procmultivisit] ADD CONSTRAINT [fk_procmultivisit_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procmultivisit] ADD CONSTRAINT [fk_procmultivisit_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procnote] ADD CONSTRAINT [fk_procnote_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procnote] ADD CONSTRAINT [fk_procnote_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[procnote] ADD CONSTRAINT [fk_procnote_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proctp] ADD CONSTRAINT [fk_proctp_1_TreatPlanNum] FOREIGN KEY ([TreatPlanNum]) REFERENCES [dbo].[treatplan]([TreatPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proctp] ADD CONSTRAINT [fk_proctp_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proctp] ADD CONSTRAINT [fk_proctp_3_ProcNumOrig] FOREIGN KEY ([ProcNumOrig]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proctp] ADD CONSTRAINT [fk_proctp_4_Priority] FOREIGN KEY ([Priority]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proctp] ADD CONSTRAINT [fk_proctp_5_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proctp] ADD CONSTRAINT [fk_proctp_6_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[proctp] ADD CONSTRAINT [fk_proctp_7_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[programproperty] ADD CONSTRAINT [fk_programproperty_1_ProgramNum] FOREIGN KEY ([ProgramNum]) REFERENCES [dbo].[program]([ProgramNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[programproperty] ADD CONSTRAINT [fk_programproperty_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[promotion] ADD CONSTRAINT [fk_promotion_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[promotionlog] ADD CONSTRAINT [fk_promotionlog_1_PromotionNum] FOREIGN KEY ([PromotionNum]) REFERENCES [dbo].[promotion]([PromotionNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[promotionlog] ADD CONSTRAINT [fk_promotionlog_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[promotionlog] ADD CONSTRAINT [fk_promotionlog_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[promotionlog] ADD CONSTRAINT [fk_promotionlog_4_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [dbo].[apptreminderrule]([ApptReminderRuleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[provider] ADD CONSTRAINT [fk_provider_1_FeeSched] FOREIGN KEY ([FeeSched]) REFERENCES [dbo].[feesched]([FeeSchedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[provider] ADD CONSTRAINT [fk_provider_2_Specialty] FOREIGN KEY ([Specialty]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[provider] ADD CONSTRAINT [fk_provider_3_SchoolClassNum] FOREIGN KEY ([SchoolClassNum]) REFERENCES [dbo].[schoolclass]([SchoolClassNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[provider] ADD CONSTRAINT [fk_provider_4_EmailAddressNum] FOREIGN KEY ([EmailAddressNum]) REFERENCES [dbo].[emailaddress]([EmailAddressNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[provider] ADD CONSTRAINT [fk_provider_5_ProvNumBillingOverride] FOREIGN KEY ([ProvNumBillingOverride]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[providerclinic] ADD CONSTRAINT [fk_providerclinic_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[providerclinic] ADD CONSTRAINT [fk_providerclinic_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[providercliniclink] ADD CONSTRAINT [fk_providercliniclink_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[providercliniclink] ADD CONSTRAINT [fk_providercliniclink_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[providererx] ADD CONSTRAINT [fk_providererx_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[providererx] ADD CONSTRAINT [fk_providererx_2_RegistrationKeyNum] FOREIGN KEY ([RegistrationKeyNum]) REFERENCES [dbo].[registrationkey]([RegistrationKeyNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[providerident] ADD CONSTRAINT [fk_providerident_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[providerident] ADD CONSTRAINT [fk_providerident_2_PayorID] FOREIGN KEY ([PayorID]) REFERENCES [dbo].[carrier]([ElectID]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[question] ADD CONSTRAINT [fk_question_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[question] ADD CONSTRAINT [fk_question_2_FormPatNum] FOREIGN KEY ([FormPatNum]) REFERENCES [dbo].[formpat]([FormPatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[quickpastenote] ADD CONSTRAINT [fk_quickpastenote_1_QuickPasteCatNum] FOREIGN KEY ([QuickPasteCatNum]) REFERENCES [dbo].[quickpastecat]([QuickPasteCatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reactivation] ADD CONSTRAINT [fk_reactivation_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reactivation] ADD CONSTRAINT [fk_reactivation_2_ReactivationStatus] FOREIGN KEY ([ReactivationStatus]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recall] ADD CONSTRAINT [fk_recall_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recall] ADD CONSTRAINT [fk_recall_2_RecallStatus] FOREIGN KEY ([RecallStatus]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recall] ADD CONSTRAINT [fk_recall_3_RecallTypeNum] FOREIGN KEY ([RecallTypeNum]) REFERENCES [dbo].[recalltype]([RecallTypeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recalltrigger] ADD CONSTRAINT [fk_recalltrigger_1_RecallTypeNum] FOREIGN KEY ([RecallTypeNum]) REFERENCES [dbo].[recalltype]([RecallTypeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recalltrigger] ADD CONSTRAINT [fk_recalltrigger_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reconcile] ADD CONSTRAINT [fk_reconcile_1_AccountNum] FOREIGN KEY ([AccountNum]) REFERENCES [dbo].[account]([AccountNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recurringcharge] ADD CONSTRAINT [fk_recurringcharge_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recurringcharge] ADD CONSTRAINT [fk_recurringcharge_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recurringcharge] ADD CONSTRAINT [fk_recurringcharge_3_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recurringcharge] ADD CONSTRAINT [fk_recurringcharge_4_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [dbo].[payment]([PayNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[recurringcharge] ADD CONSTRAINT [fk_recurringcharge_5_CreditCardNum] FOREIGN KEY ([CreditCardNum]) REFERENCES [dbo].[creditcard]([CreditCardNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[refattach] ADD CONSTRAINT [fk_refattach_1_ReferralNum] FOREIGN KEY ([ReferralNum]) REFERENCES [dbo].[referral]([ReferralNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[refattach] ADD CONSTRAINT [fk_refattach_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[refattach] ADD CONSTRAINT [fk_refattach_3_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[refattach] ADD CONSTRAINT [fk_refattach_4_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[referral] ADD CONSTRAINT [fk_referral_1_Specialty] FOREIGN KEY ([Specialty]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[referral] ADD CONSTRAINT [fk_referral_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[referral] ADD CONSTRAINT [fk_referral_3_Slip] FOREIGN KEY ([Slip]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[referralcliniclink] ADD CONSTRAINT [fk_referralcliniclink_1_ReferralNum] FOREIGN KEY ([ReferralNum]) REFERENCES [dbo].[referral]([ReferralNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[referralcliniclink] ADD CONSTRAINT [fk_referralcliniclink_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[registrationkey] ADD CONSTRAINT [fk_registrationkey_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[repeatcharge] ADD CONSTRAINT [fk_repeatcharge_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[repeatcharge] ADD CONSTRAINT [fk_repeatcharge_2_ProcCode] FOREIGN KEY ([ProcCode]) REFERENCES [dbo].[procedurecode]([ProcCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reqneeded] ADD CONSTRAINT [fk_reqneeded_1_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [dbo].[schoolcourse]([SchoolCourseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reqneeded] ADD CONSTRAINT [fk_reqneeded_2_SchoolClassNum] FOREIGN KEY ([SchoolClassNum]) REFERENCES [dbo].[schoolclass]([SchoolClassNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reqneeded] ADD CONSTRAINT [fk_reqneeded_3_SchoolCourseDefNum] FOREIGN KEY ([SchoolCourseDefNum]) REFERENCES [dbo].[schoolcoursedef]([SchoolCourseDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reqstudent] ADD CONSTRAINT [fk_reqstudent_1_ReqNeededNum] FOREIGN KEY ([ReqNeededNum]) REFERENCES [dbo].[reqneeded]([ReqNeededNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reqstudent] ADD CONSTRAINT [fk_reqstudent_2_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [dbo].[schoolcourse]([SchoolCourseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reqstudent] ADD CONSTRAINT [fk_reqstudent_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reqstudent] ADD CONSTRAINT [fk_reqstudent_4_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reqstudent] ADD CONSTRAINT [fk_reqstudent_5_InstructorNum] FOREIGN KEY ([InstructorNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reqstudent] ADD CONSTRAINT [fk_reqstudent_6_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[requiredfieldcondition] ADD CONSTRAINT [fk_requiredfieldcondition_1_RequiredFieldNum] FOREIGN KEY ([RequiredFieldNum]) REFERENCES [dbo].[requiredfield]([RequiredFieldNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[rxalert] ADD CONSTRAINT [fk_rxalert_1_RxDefNum] FOREIGN KEY ([RxDefNum]) REFERENCES [dbo].[rxdef]([RxDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[rxalert] ADD CONSTRAINT [fk_rxalert_2_DiseaseDefNum] FOREIGN KEY ([DiseaseDefNum]) REFERENCES [dbo].[diseasedef]([DiseaseDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[rxalert] ADD CONSTRAINT [fk_rxalert_3_AllergyDefNum] FOREIGN KEY ([AllergyDefNum]) REFERENCES [dbo].[allergydef]([AllergyDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[rxalert] ADD CONSTRAINT [fk_rxalert_4_MedicationNum] FOREIGN KEY ([MedicationNum]) REFERENCES [dbo].[medication]([MedicationNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[rxpat] ADD CONSTRAINT [fk_rxpat_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[rxpat] ADD CONSTRAINT [fk_rxpat_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[rxpat] ADD CONSTRAINT [fk_rxpat_3_PharmacyNum] FOREIGN KEY ([PharmacyNum]) REFERENCES [dbo].[pharmacy]([PharmacyNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[rxpat] ADD CONSTRAINT [fk_rxpat_4_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[rxpat] ADD CONSTRAINT [fk_rxpat_5_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schedule] ADD CONSTRAINT [fk_schedule_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schedule] ADD CONSTRAINT [fk_schedule_2_BlockoutType] FOREIGN KEY ([BlockoutType]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schedule] ADD CONSTRAINT [fk_schedule_3_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [dbo].[employee]([EmployeeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schedule] ADD CONSTRAINT [fk_schedule_4_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[scheduleop] ADD CONSTRAINT [fk_scheduleop_1_ScheduleNum] FOREIGN KEY ([ScheduleNum]) REFERENCES [dbo].[schedule]([ScheduleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[scheduleop] ADD CONSTRAINT [fk_scheduleop_2_OperatoryNum] FOREIGN KEY ([OperatoryNum]) REFERENCES [dbo].[operatory]([OperatoryNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_10_MountNum] FOREIGN KEY ([MountNum]) REFERENCES [dbo].[mount]([MountNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_2_InstructorNum] FOREIGN KEY ([InstructorNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_3_AptNum] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_4_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_5_TreatPlanNum] FOREIGN KEY ([TreatPlanNum]) REFERENCES [dbo].[treatplan]([TreatPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_6_PerioExamNum] FOREIGN KEY ([PerioExamNum]) REFERENCES [dbo].[perioexam]([PerioExamNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_7_AllergyNum] FOREIGN KEY ([AllergyNum]) REFERENCES [dbo].[allergy]([AllergyNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_8_DiseaseNum] FOREIGN KEY ([DiseaseNum]) REFERENCES [dbo].[disease]([DiseaseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolapproval] ADD CONSTRAINT [fk_schoolapproval_9_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolcourse] ADD CONSTRAINT [fk_schoolcourse_1_SchoolClassNum] FOREIGN KEY ([SchoolClassNum]) REFERENCES [dbo].[schoolclass]([SchoolClassNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolcourse] ADD CONSTRAINT [fk_schoolcourse_2_GradingScaleNum] FOREIGN KEY ([GradingScaleNum]) REFERENCES [dbo].[gradingscale]([GradingScaleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolcoursedef] ADD CONSTRAINT [fk_schoolcoursedef_1_GradingScaleNum] FOREIGN KEY ([GradingScaleNum]) REFERENCES [dbo].[gradingscale]([GradingScaleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolcourseenrollee] ADD CONSTRAINT [fk_schoolcourseenrollee_1_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [dbo].[schoolcourse]([SchoolCourseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolcourseenrollee] ADD CONSTRAINT [fk_schoolcourseenrollee_2_StudentNum] FOREIGN KEY ([StudentNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolcourseinstructor] ADD CONSTRAINT [fk_schoolcourseinstructor_1_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [dbo].[schoolcourse]([SchoolCourseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolcourseinstructor] ADD CONSTRAINT [fk_schoolcourseinstructor_2_InstructorNum] FOREIGN KEY ([InstructorNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolcoursesched] ADD CONSTRAINT [fk_schoolcoursesched_1_SchoolCourseDefNum] FOREIGN KEY ([SchoolCourseDefNum]) REFERENCES [dbo].[schoolcoursedef]([SchoolCourseDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[schoolcoursesched] ADD CONSTRAINT [fk_schoolcoursesched_2_SchoolCourseNum] FOREIGN KEY ([SchoolCourseNum]) REFERENCES [dbo].[schoolcourse]([SchoolCourseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screen] ADD CONSTRAINT [fk_screen_1_ScreenGroupNum] FOREIGN KEY ([ScreenGroupNum]) REFERENCES [dbo].[screengroup]([ScreenGroupNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screen] ADD CONSTRAINT [fk_screen_2_ScreenPatNum] FOREIGN KEY ([ScreenPatNum]) REFERENCES [dbo].[screenpat]([ScreenPatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screen] ADD CONSTRAINT [fk_screen_3_SheetNum] FOREIGN KEY ([SheetNum]) REFERENCES [dbo].[sheet]([SheetNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screengroup] ADD CONSTRAINT [fk_screengroup_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screengroup] ADD CONSTRAINT [fk_screengroup_2_County] FOREIGN KEY ([County]) REFERENCES [dbo].[county]([CountyName]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screengroup] ADD CONSTRAINT [fk_screengroup_3_GradeSchool] FOREIGN KEY ([GradeSchool]) REFERENCES [dbo].[site]([Description]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screengroup] ADD CONSTRAINT [fk_screengroup_4_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screenpat] ADD CONSTRAINT [fk_screenpat_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screenpat] ADD CONSTRAINT [fk_screenpat_2_ScreenGroupNum] FOREIGN KEY ([ScreenGroupNum]) REFERENCES [dbo].[screengroup]([ScreenGroupNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[screenpat] ADD CONSTRAINT [fk_screenpat_3_SheetNum] FOREIGN KEY ([SheetNum]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[securitylog] ADD CONSTRAINT [fk_securitylog_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[securitylog] ADD CONSTRAINT [fk_securitylog_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[securityloghash] ADD CONSTRAINT [fk_securityloghash_1_SecurityLogNum] FOREIGN KEY ([SecurityLogNum]) REFERENCES [dbo].[securitylog]([SecurityLogNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sheet] ADD CONSTRAINT [fk_sheet_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sheet] ADD CONSTRAINT [fk_sheet_2_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sheet] ADD CONSTRAINT [fk_sheet_3_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sheet] ADD CONSTRAINT [fk_sheet_4_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sheetdef] ADD CONSTRAINT [fk_sheetdef_1_AutoCheckSaveImageDocCategory] FOREIGN KEY ([AutoCheckSaveImageDocCategory]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sheetfield] ADD CONSTRAINT [fk_sheetfield_1_SheetNum] FOREIGN KEY ([SheetNum]) REFERENCES [dbo].[sheet]([SheetNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sheetfield] ADD CONSTRAINT [fk_sheetfield_3_SheetFieldDefNum] FOREIGN KEY ([SheetFieldDefNum]) REFERENCES [dbo].[sheetfielddef]([SheetFieldDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sheetfield] ADD CONSTRAINT [fk_sheetfield_4_UserSigned] FOREIGN KEY ([UserSigned]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sheetfielddef] ADD CONSTRAINT [fk_sheetfielddef_1_SheetDefNum] FOREIGN KEY ([SheetDefNum]) REFERENCES [dbo].[sheetdef]([SheetDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sigbutdef] ADD CONSTRAINT [fk_sigbutdef_1_SigElementDefNumUser] FOREIGN KEY ([SigElementDefNumUser]) REFERENCES [dbo].[sigelementdef]([SigElementDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sigbutdef] ADD CONSTRAINT [fk_sigbutdef_2_SigElementDefNumExtra] FOREIGN KEY ([SigElementDefNumExtra]) REFERENCES [dbo].[sigelementdef]([SigElementDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sigbutdef] ADD CONSTRAINT [fk_sigbutdef_3_SigElementDefNumMsg] FOREIGN KEY ([SigElementDefNumMsg]) REFERENCES [dbo].[sigelementdef]([SigElementDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sigmessage] ADD CONSTRAINT [fk_sigmessage_1_SigElementDefNumUser] FOREIGN KEY ([SigElementDefNumUser]) REFERENCES [dbo].[sigelementdef]([SigElementDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sigmessage] ADD CONSTRAINT [fk_sigmessage_2_SigElementDefNumExtra] FOREIGN KEY ([SigElementDefNumExtra]) REFERENCES [dbo].[sigelementdef]([SigElementDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sigmessage] ADD CONSTRAINT [fk_sigmessage_3_SigElementDefNumMsg] FOREIGN KEY ([SigElementDefNumMsg]) REFERENCES [dbo].[sigelementdef]([SigElementDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[site] ADD CONSTRAINT [fk_site_1_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[smsfrommobile] ADD CONSTRAINT [fk_smsfrommobile_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[smsfrommobile] ADD CONSTRAINT [fk_smsfrommobile_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[smsfrommobile] ADD CONSTRAINT [fk_smsfrommobile_3_CommlogNum] FOREIGN KEY ([CommlogNum]) REFERENCES [dbo].[commlog]([CommlogNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[smsfrommobile] ADD CONSTRAINT [fk_smsfrommobile_4_GuidMessage] FOREIGN KEY ([GuidMessage]) REFERENCES [dbo].[confirmationrequest]([GuidMessageFromMobile]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[smsphone] ADD CONSTRAINT [fk_smsphone_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[smstomobile] ADD CONSTRAINT [fk_smstomobile_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[smstomobile] ADD CONSTRAINT [fk_smstomobile_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[statement] ADD CONSTRAINT [fk_statement_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[statement] ADD CONSTRAINT [fk_statement_2_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[statement] ADD CONSTRAINT [fk_statement_3_SuperFamily] FOREIGN KEY ([SuperFamily]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[statementprod] ADD CONSTRAINT [fk_statementprod_1_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [dbo].[statement]([StatementNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[statementprod] ADD CONSTRAINT [fk_statementprod_2_LateChargeAdjNum] FOREIGN KEY ([LateChargeAdjNum]) REFERENCES [dbo].[adjustment]([AdjNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[statementprod] ADD CONSTRAINT [fk_statementprod_3_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[stmtlink] ADD CONSTRAINT [fk_stmtlink_1_StatementNum] FOREIGN KEY ([StatementNum]) REFERENCES [dbo].[statement]([StatementNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[substitutionlink] ADD CONSTRAINT [fk_substitutionlink_1_PlanNum] FOREIGN KEY ([PlanNum]) REFERENCES [dbo].[insplan]([PlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[substitutionlink] ADD CONSTRAINT [fk_substitutionlink_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[substitutionlink] ADD CONSTRAINT [fk_substitutionlink_3_SubstitutionCode] FOREIGN KEY ([SubstitutionCode]) REFERENCES [dbo].[procedurecode]([ProcCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[supply] ADD CONSTRAINT [fk_supply_1_SupplierNum] FOREIGN KEY ([SupplierNum]) REFERENCES [dbo].[supplier]([SupplierNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[supply] ADD CONSTRAINT [fk_supply_2_Category] FOREIGN KEY ([Category]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[supplyorder] ADD CONSTRAINT [fk_supplyorder_1_SupplierNum] FOREIGN KEY ([SupplierNum]) REFERENCES [dbo].[supplier]([SupplierNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[supplyorder] ADD CONSTRAINT [fk_supplyorder_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[supplyorderitem] ADD CONSTRAINT [fk_supplyorderitem_1_SupplyOrderNum] FOREIGN KEY ([SupplyOrderNum]) REFERENCES [dbo].[supplyorder]([SupplyOrderNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[supplyorderitem] ADD CONSTRAINT [fk_supplyorderitem_2_SupplyNum] FOREIGN KEY ([SupplyNum]) REFERENCES [dbo].[supply]([SupplyNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[task] ADD CONSTRAINT [fk_task_1_TaskListNum] FOREIGN KEY ([TaskListNum]) REFERENCES [dbo].[tasklist]([TaskListNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[task] ADD CONSTRAINT [fk_task_2_KeyNum] FOREIGN KEY ([KeyNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[task] ADD CONSTRAINT [fk_task_3_FromNum] FOREIGN KEY ([FromNum]) REFERENCES [dbo].[task]([TaskNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[task] ADD CONSTRAINT [fk_task_4_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[task] ADD CONSTRAINT [fk_task_5_PriorityDefNum] FOREIGN KEY ([PriorityDefNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[task] ADD CONSTRAINT [fk_task_6_Category] FOREIGN KEY ([Category]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[taskancestor] ADD CONSTRAINT [fk_taskancestor_1_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [dbo].[task]([TaskNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[taskancestor] ADD CONSTRAINT [fk_taskancestor_2_TaskListNum] FOREIGN KEY ([TaskListNum]) REFERENCES [dbo].[tasklist]([TaskListNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[taskattachment] ADD CONSTRAINT [fk_taskattachment_1_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [dbo].[task]([TaskNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[taskattachment] ADD CONSTRAINT [fk_taskattachment_2_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[taskhist] ADD CONSTRAINT [fk_taskhist_1_UserNumHist] FOREIGN KEY ([UserNumHist]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tasklist] ADD CONSTRAINT [fk_tasklist_1_Parent] FOREIGN KEY ([Parent]) REFERENCES [dbo].[tasklist]([TaskListNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tasklist] ADD CONSTRAINT [fk_tasklist_2_FromNum] FOREIGN KEY ([FromNum]) REFERENCES [dbo].[tasklist]([TaskListNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tasknote] ADD CONSTRAINT [fk_tasknote_1_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [dbo].[task]([TaskNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tasknote] ADD CONSTRAINT [fk_tasknote_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tasksubscription] ADD CONSTRAINT [fk_tasksubscription_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tasksubscription] ADD CONSTRAINT [fk_tasksubscription_2_TaskListNum] FOREIGN KEY ([TaskListNum]) REFERENCES [dbo].[tasklist]([TaskListNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tasksubscription] ADD CONSTRAINT [fk_tasksubscription_3_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [dbo].[task]([TaskNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[taskunread] ADD CONSTRAINT [fk_taskunread_1_TaskNum] FOREIGN KEY ([TaskNum]) REFERENCES [dbo].[task]([TaskNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[taskunread] ADD CONSTRAINT [fk_taskunread_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[terminalactive] ADD CONSTRAINT [fk_terminalactive_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[timeadjust] ADD CONSTRAINT [fk_timeadjust_1_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [dbo].[employee]([EmployeeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[timeadjust] ADD CONSTRAINT [fk_timeadjust_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[timeadjust] ADD CONSTRAINT [fk_timeadjust_3_PtoDefNum] FOREIGN KEY ([PtoDefNum]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[timeadjust] ADD CONSTRAINT [fk_timeadjust_4_SecuUserNumEntry] FOREIGN KEY ([SecuUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[timecardrule] ADD CONSTRAINT [fk_timecardrule_1_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [dbo].[employee]([EmployeeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[toolbutitem] ADD CONSTRAINT [fk_toolbutitem_1_ProgramNum] FOREIGN KEY ([ProgramNum]) REFERENCES [dbo].[program]([ProgramNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[toothgridcell] ADD CONSTRAINT [fk_toothgridcell_1_SheetFieldNum] FOREIGN KEY ([SheetFieldNum]) REFERENCES [dbo].[sheetfield]([SheetFieldNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[toothgridcell] ADD CONSTRAINT [fk_toothgridcell_2_ToothGridColNum] FOREIGN KEY ([ToothGridColNum]) REFERENCES [dbo].[toothgridcol]([ToothGridColNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[toothgridcol] ADD CONSTRAINT [fk_toothgridcol_1_SheetFieldNum] FOREIGN KEY ([SheetFieldNum]) REFERENCES [dbo].[sheetfield]([SheetFieldNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[toothgridcol] ADD CONSTRAINT [fk_toothgridcol_2_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[toothgriddef] ADD CONSTRAINT [fk_toothgriddef_1_CodeNum] FOREIGN KEY ([CodeNum]) REFERENCES [dbo].[procedurecode]([CodeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[toothgriddef] ADD CONSTRAINT [fk_toothgriddef_2_SheetFieldDefNum] FOREIGN KEY ([SheetFieldDefNum]) REFERENCES [dbo].[sheetfielddef]([SheetFieldDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[toothinitial] ADD CONSTRAINT [fk_toothinitial_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[transaction] ADD CONSTRAINT [fk_transaction_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[transaction] ADD CONSTRAINT [fk_transaction_2_DepositNum] FOREIGN KEY ([DepositNum]) REFERENCES [dbo].[deposit]([DepositNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[transaction] ADD CONSTRAINT [fk_transaction_3_PayNum] FOREIGN KEY ([PayNum]) REFERENCES [dbo].[payment]([PayNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[transaction] ADD CONSTRAINT [fk_transaction_4_SecUserNumEdit] FOREIGN KEY ([SecUserNumEdit]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[transaction] ADD CONSTRAINT [fk_transaction_5_TransactionInvoiceNum] FOREIGN KEY ([TransactionInvoiceNum]) REFERENCES [dbo].[transactioninvoice]([TransactionInvoiceNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplan] ADD CONSTRAINT [fk_treatplan_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplan] ADD CONSTRAINT [fk_treatplan_2_ResponsParty] FOREIGN KEY ([ResponsParty]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplan] ADD CONSTRAINT [fk_treatplan_3_DocNum] FOREIGN KEY ([DocNum]) REFERENCES [dbo].[document]([DocNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplan] ADD CONSTRAINT [fk_treatplan_4_SecUserNumEntry] FOREIGN KEY ([SecUserNumEntry]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplan] ADD CONSTRAINT [fk_treatplan_5_UserNumPresenter] FOREIGN KEY ([UserNumPresenter]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplan] ADD CONSTRAINT [fk_treatplan_6_MobileAppDeviceNum] FOREIGN KEY ([MobileAppDeviceNum]) REFERENCES [dbo].[mobileappdevice]([MobileAppDeviceNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplanattach] ADD CONSTRAINT [fk_treatplanattach_1_TreatPlanNum] FOREIGN KEY ([TreatPlanNum]) REFERENCES [dbo].[treatplan]([TreatPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplanattach] ADD CONSTRAINT [fk_treatplanattach_2_ProcNum] FOREIGN KEY ([ProcNum]) REFERENCES [dbo].[procedurelog]([ProcNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplanattach] ADD CONSTRAINT [fk_treatplanattach_3_Priority] FOREIGN KEY ([Priority]) REFERENCES [dbo].[definition]([DefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplanparam] ADD CONSTRAINT [fk_treatplanparam_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatplanparam] ADD CONSTRAINT [fk_treatplanparam_2_TreatPlanNum] FOREIGN KEY ([TreatPlanNum]) REFERENCES [dbo].[treatplan]([TreatPlanNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tsitranslog] ADD CONSTRAINT [fk_tsitranslog_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tsitranslog] ADD CONSTRAINT [fk_tsitranslog_2_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tsitranslog] ADD CONSTRAINT [fk_tsitranslog_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tsitranslog] ADD CONSTRAINT [fk_tsitranslog_4_AggTransLogNum] FOREIGN KEY ([AggTransLogNum]) REFERENCES [dbo].[tsitranslog]([TsiTransLogNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userclinic] ADD CONSTRAINT [fk_userclinic_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userclinic] ADD CONSTRAINT [fk_userclinic_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[usergroup] ADD CONSTRAINT [fk_usergroup_1_UserGroupNumCEMT] FOREIGN KEY ([UserGroupNumCEMT]) REFERENCES [dbo].[usergroup]([UserGroupNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[usergroupattach] ADD CONSTRAINT [fk_usergroupattach_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[usergroupattach] ADD CONSTRAINT [fk_usergroupattach_2_UserGroupNum] FOREIGN KEY ([UserGroupNum]) REFERENCES [dbo].[usergroup]([UserGroupNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userod] ADD CONSTRAINT [fk_userod_1_EmployeeNum] FOREIGN KEY ([EmployeeNum]) REFERENCES [dbo].[employee]([EmployeeNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userod] ADD CONSTRAINT [fk_userod_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userod] ADD CONSTRAINT [fk_userod_3_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userod] ADD CONSTRAINT [fk_userod_4_TaskListInBox] FOREIGN KEY ([TaskListInBox]) REFERENCES [dbo].[tasklist]([TaskListNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userod] ADD CONSTRAINT [fk_userod_5_UserNumCEMT] FOREIGN KEY ([UserNumCEMT]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userodapptview] ADD CONSTRAINT [fk_userodapptview_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userodapptview] ADD CONSTRAINT [fk_userodapptview_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userodapptview] ADD CONSTRAINT [fk_userodapptview_3_ApptViewNum] FOREIGN KEY ([ApptViewNum]) REFERENCES [dbo].[apptview]([ApptViewNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userodpref] ADD CONSTRAINT [fk_userodpref_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[userodpref] ADD CONSTRAINT [fk_userodpref_2_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[usertoken] ADD CONSTRAINT [fk_usertoken_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vaccinedef] ADD CONSTRAINT [fk_vaccinedef_1_DrugManufacturerNum] FOREIGN KEY ([DrugManufacturerNum]) REFERENCES [dbo].[drugmanufacturer]([DrugManufacturerNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vaccineobs] ADD CONSTRAINT [fk_vaccineobs_1_VaccinePatNum] FOREIGN KEY ([VaccinePatNum]) REFERENCES [dbo].[vaccinepat]([VaccinePatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vaccineobs] ADD CONSTRAINT [fk_vaccineobs_2_VaccineObsNumGroup] FOREIGN KEY ([VaccineObsNumGroup]) REFERENCES [dbo].[vaccineobs]([VaccineObsNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vaccinepat] ADD CONSTRAINT [fk_vaccinepat_1_VaccineDefNum] FOREIGN KEY ([VaccineDefNum]) REFERENCES [dbo].[vaccinedef]([VaccineDefNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vaccinepat] ADD CONSTRAINT [fk_vaccinepat_2_DrugUnitNum] FOREIGN KEY ([DrugUnitNum]) REFERENCES [dbo].[drugunit]([DrugUnitNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vaccinepat] ADD CONSTRAINT [fk_vaccinepat_3_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vaccinepat] ADD CONSTRAINT [fk_vaccinepat_4_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vaccinepat] ADD CONSTRAINT [fk_vaccinepat_5_ProvNumOrdering] FOREIGN KEY ([ProvNumOrdering]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vaccinepat] ADD CONSTRAINT [fk_vaccinepat_6_ProvNumAdminister] FOREIGN KEY ([ProvNumAdminister]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vitalsign] ADD CONSTRAINT [fk_vitalsign_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vitalsign] ADD CONSTRAINT [fk_vitalsign_2_HeightExamCode] FOREIGN KEY ([HeightExamCode]) REFERENCES [dbo].[ehrcode]([CodeValue]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vitalsign] ADD CONSTRAINT [fk_vitalsign_3_HeightExamCode] FOREIGN KEY ([HeightExamCode]) REFERENCES [dbo].[loinc]([LoincCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vitalsign] ADD CONSTRAINT [fk_vitalsign_4_WeightExamCode] FOREIGN KEY ([WeightExamCode]) REFERENCES [dbo].[ehrcode]([CodeValue]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vitalsign] ADD CONSTRAINT [fk_vitalsign_5_WeightExamCode] FOREIGN KEY ([WeightExamCode]) REFERENCES [dbo].[loinc]([LoincCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vitalsign] ADD CONSTRAINT [fk_vitalsign_6_BMIExamCode] FOREIGN KEY ([BMIExamCode]) REFERENCES [dbo].[ehrcode]([CodeValue]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vitalsign] ADD CONSTRAINT [fk_vitalsign_7_BMIExamCode] FOREIGN KEY ([BMIExamCode]) REFERENCES [dbo].[loinc]([LoincCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vitalsign] ADD CONSTRAINT [fk_vitalsign_8_EhrNotPerformedNum] FOREIGN KEY ([EhrNotPerformedNum]) REFERENCES [dbo].[ehrnotperformed]([EhrNotPerformedNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vitalsign] ADD CONSTRAINT [fk_vitalsign_9_PregDiseaseNum] FOREIGN KEY ([PregDiseaseNum]) REFERENCES [dbo].[disease]([DiseaseNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[webschedcarrierrule] ADD CONSTRAINT [fk_webschedcarrierrule_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[webschedrecall] ADD CONSTRAINT [fk_webschedrecall_1_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[webschedrecall] ADD CONSTRAINT [fk_webschedrecall_2_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[webschedrecall] ADD CONSTRAINT [fk_webschedrecall_3_RecallNum] FOREIGN KEY ([RecallNum]) REFERENCES [dbo].[recall]([RecallNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[webschedrecall] ADD CONSTRAINT [fk_webschedrecall_4_CommlogNum] FOREIGN KEY ([CommlogNum]) REFERENCES [dbo].[commlog]([CommlogNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[webschedrecall] ADD CONSTRAINT [fk_webschedrecall_5_ApptReminderRuleNum] FOREIGN KEY ([ApptReminderRuleNum]) REFERENCES [dbo].[apptreminderrule]([ApptReminderRuleNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[wikilisthist] ADD CONSTRAINT [fk_wikilisthist_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[wikipage] ADD CONSTRAINT [fk_wikipage_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[wikipagehist] ADD CONSTRAINT [fk_wikipagehist_1_UserNum] FOREIGN KEY ([UserNum]) REFERENCES [dbo].[userod]([UserNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[xchargetransaction] ADD CONSTRAINT [fk_xchargetransaction_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[xwebresponse] ADD CONSTRAINT [fk_xwebresponse_1_PatNum] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[xwebresponse] ADD CONSTRAINT [fk_xwebresponse_2_ProvNum] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[xwebresponse] ADD CONSTRAINT [fk_xwebresponse_3_ClinicNum] FOREIGN KEY ([ClinicNum]) REFERENCES [dbo].[clinic]([ClinicNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[xwebresponse] ADD CONSTRAINT [fk_xwebresponse_4_PaymentNum] FOREIGN KEY ([PaymentNum]) REFERENCES [dbo].[payment]([PayNum]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[examradiographic] ADD CONSTRAINT [examradiographic_PatNum_fkey] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examradiographic] ADD CONSTRAINT [examradiographic_AptNum_fkey] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examradiographic] ADD CONSTRAINT [examradiographic_ProvNum_fkey] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examtmj] ADD CONSTRAINT [examtmj_PatNum_fkey] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examtmj] ADD CONSTRAINT [examtmj_AptNum_fkey] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examtmj] ADD CONSTRAINT [examtmj_ProvNum_fkey] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examheadneck] ADD CONSTRAINT [examheadneck_PatNum_fkey] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examheadneck] ADD CONSTRAINT [examheadneck_AptNum_fkey] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examheadneck] ADD CONSTRAINT [examheadneck_ProvNum_fkey] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examtoothstructure] ADD CONSTRAINT [examtoothstructure_PatNum_fkey] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examtoothstructure] ADD CONSTRAINT [examtoothstructure_AptNum_fkey] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examtoothstructure] ADD CONSTRAINT [examtoothstructure_ProvNum_fkey] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[exammorphological] ADD CONSTRAINT [exammorphological_PatNum_fkey] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[exammorphological] ADD CONSTRAINT [exammorphological_AptNum_fkey] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[exammorphological] ADD CONSTRAINT [exammorphological_ProvNum_fkey] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examperiodontal] ADD CONSTRAINT [examperiodontal_PatNum_fkey] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examperiodontal] ADD CONSTRAINT [examperiodontal_AptNum_fkey] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examperiodontal] ADD CONSTRAINT [examperiodontal_ProvNum_fkey] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examdentofacial] ADD CONSTRAINT [examdentofacial_PatNum_fkey] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examdentofacial] ADD CONSTRAINT [examdentofacial_AptNum_fkey] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examdentofacial] ADD CONSTRAINT [examdentofacial_ProvNum_fkey] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examairway] ADD CONSTRAINT [examairway_PatNum_fkey] FOREIGN KEY ([PatNum]) REFERENCES [dbo].[patient]([PatNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examairway] ADD CONSTRAINT [examairway_AptNum_fkey] FOREIGN KEY ([AptNum]) REFERENCES [dbo].[appointment]([AptNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[examairway] ADD CONSTRAINT [examairway_ProvNum_fkey] FOREIGN KEY ([ProvNum]) REFERENCES [dbo].[provider]([ProvNum]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[clinicalproductchoice] ADD CONSTRAINT [clinicalproductchoice_CategoryId_fkey] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[clinicalproductcategory]([CategoryId]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[clinicalchecklist] ADD CONSTRAINT [clinicalchecklist_CategoryId_fkey] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[clinicalchecklistcategory]([CategoryId]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[clinicalchecklistitem] ADD CONSTRAINT [clinicalchecklistitem_ChecklistId_fkey] FOREIGN KEY ([ChecklistId]) REFERENCES [dbo].[clinicalchecklist]([ChecklistId]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
